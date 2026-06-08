import { test, expect } from "@playwright/test";
import { prisma } from "../../server/lib/prisma.js";
import { API, USERS, apiAuth, apiLogin, authPage, bearer, getDepartments } from "../helpers/auth.js";
import { decisionRoutage } from "../../server/services/cycleDemande.js";
import { executerScheduler } from "../../server/scheduler.js";
const mk = (request, token, body) =>
  request.post(`${API}/api/tickets`, { headers: bearer(token), data: body }).then((r) => r.json()).then((j) => j.ticket);

test.afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { title: { startsWith: "[E2E]" } } });
  await prisma.$disconnect();
});

test.describe("Routage, validation & SLA", () => {
  test("unité : matrice de routage (express / tri / validation)", () => {
    expect(decisionRoutage({ type: "INTERVENTION", urgency: "URGENT", destinationClaire: true }).statut).toBe("NEW");
    expect(decisionRoutage({ type: "INTERVENTION", urgency: "NORMAL", destinationClaire: false }).statut).toBe("A_TRIER");
    expect(decisionRoutage({ type: "NEED", urgency: "CRITIQUE", destinationClaire: true }).statut).toBe("EN_ATTENTE_VALIDATION");
    expect(decisionRoutage({ type: "NEED", urgency: "NORMAL", destinationClaire: false }).statut).toBe("A_TRIER");
  });

  test("API : une urgence haute (Intervention) saute le tri → file + SLA", async ({ request }) => {
    const { token } = await apiAuth(request, USERS.aya);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    const t = await mk(request, token, { title: "[E2E] express", description: "x", type: "INTERVENTION", urgency: "URGENT", space: "GLOBAL", departmentId: it.id });
    expect(t.status).toBe("NEW");
    expect(t.priseEnMainAvant).toBeTruthy();
    expect(t.escaladeA).toBeTruthy();
  });

  test("API : un Besoin attend le feu vert du responsable avant d'entrer en file", async ({ request }) => {
    const subTok = await apiLogin(request, USERS.aya);
    const it = (await getDepartments(request, subTok)).find((d) => d.name === "Informatique");
    const t = await mk(request, subTok, { title: "[E2E] besoin-valid", description: "x", type: "NEED", urgency: "NORMAL", space: "GLOBAL", departmentId: it.id });
    expect(t.status).toBe("EN_ATTENTE_VALIDATION");
    expect(t.priseEnMainAvant).toBeFalsy(); // pas de SLA tant que non validé

    // boti = responsable IT → la voit dans sa file de validation
    const botiTok = await apiLogin(request, USERS.boti);
    const aValider = await (await request.get(`${API}/api/tickets/a-valider`, { headers: bearer(botiTok) })).json();
    expect(aValider.tickets.some((x) => x.id === t.id)).toBeTruthy();

    // feu vert → entre en file + SLA
    const v = await (await request.patch(`${API}/api/tickets/${t.id}/valider`, { headers: bearer(botiTok), data: { accept: true } })).json();
    expect(v.ticket.status).toBe("NEW");
    expect(v.ticket.priseEnMainAvant).toBeTruthy();
  });

  test("API : boîte de tri — le modérateur oriente une demande sans destination", async ({ request }) => {
    const subTok = await apiLogin(request, USERS.aya);
    const it = (await getDepartments(request, subTok)).find((d) => d.name === "Informatique");
    const t = await mk(request, subTok, { title: "[E2E] tri", description: "x", type: "INTERVENTION", urgency: "NORMAL", space: "GLOBAL" });
    expect(t.status).toBe("A_TRIER");

    const adminTok = await apiLogin(request, USERS.admin);
    const box = await (await request.get(`${API}/api/tickets/a-trier`, { headers: bearer(adminTok) })).json();
    expect(box.tickets.some((x) => x.id === t.id)).toBeTruthy();
    // un non-modérateur est refusé
    expect((await request.get(`${API}/api/tickets/a-trier`, { headers: bearer(subTok) })).status()).toBe(403);

    const tr = await (await request.patch(`${API}/api/tickets/${t.id}/trier`, { headers: bearer(adminTok), data: { departmentId: it.id } })).json();
    expect(tr.ticket.status).toBe("NEW");
    expect(tr.ticket.departmentId).toBe(it.id);
    expect(tr.ticket.priseEnMainAvant).toBeTruthy();
  });

  test("API : rappel puis escalade montent les barreaux (horloge simulée) + cloche", async ({ request }) => {
    const subTok = await apiLogin(request, USERS.aya);
    const it = (await getDepartments(request, subTok)).find((d) => d.name === "Informatique");
    const t = await mk(request, subTok, { title: "[E2E] escalade", description: "x", type: "INTERVENTION", urgency: "NORMAL", space: "GLOBAL", departmentId: it.id });

    // on force les échéances dans le passé (simulation d'horloge)
    const past = new Date(Date.now() - 3600000);
    await prisma.ticket.update({ where: { id: t.id }, data: { rappelA: past, escaladeA: past, rappelEnvoye: false, niveauEscalade: 0 } });

    const r1 = await executerScheduler();
    let tk = await prisma.ticket.findUnique({ where: { id: t.id }, select: { rappelEnvoye: true, niveauEscalade: true } });
    expect(tk.rappelEnvoye).toBe(true);
    expect(tk.niveauEscalade).toBe(1); // → responsable du service

    await prisma.ticket.update({ where: { id: t.id }, data: { escaladeA: past } });
    await executerScheduler();
    tk = await prisma.ticket.findUnique({ where: { id: t.id }, select: { niveauEscalade: true } });
    expect(tk.niveauEscalade).toBe(2); // → modérateur

    // La cloche fonctionne même sans Resend : des notifications rappel/escalade existent.
    const notifs = await prisma.notification.count({ where: { ticketId: t.id, type: { in: ["rappel", "escalade"] } } });
    expect(notifs).toBeGreaterThan(0);
  });

  test("API : un modérateur en congé sort du ciblage (relève vers l'admin)", async ({ request }) => {
    const { moderateursDisponibles } = await import("../../server/services/cycleDemande.js");
    const idc = await prisma.company.findFirst({ where: { slug: "idc" } });
    const mods = await prisma.user.findMany({ where: { companyId: idc.id, peutDispatcher: true, role: "MEMBER" }, select: { id: true, presence: true } });
    const snapshot = mods.map((m) => ({ id: m.id, presence: m.presence }));
    try {
      await prisma.user.updateMany({ where: { id: { in: mods.map((m) => m.id) } }, data: { presence: "ON_LEAVE" } });
      const cible = await moderateursDisponibles(idc.id);
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      // aucun modérateur dispo → bascule vers les admins
      expect(cible.sort()).toEqual(admins.map((a) => a.id).sort());
    } finally {
      for (const s of snapshot) await prisma.user.update({ where: { id: s.id }, data: { presence: s.presence } });
    }
  });

  test("UI : le formulaire permet de laisser trier → A_TRIER", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.aya);
    await authPage(page, token);
    await page.goto("/global/form");
    await page.locator("input.input").first().fill("[E2E] form-tri");
    await page.locator("textarea.textarea").fill("description");
    await page.getByText(/laisser un modérateur orienter/).click();
    await page.getByRole("button", { name: /Soumettre la demande/ }).click();
    await expect(page.getByText("Demande soumise avec succès.")).toBeVisible();
    // vérif côté données
    const t = await prisma.ticket.findFirst({ where: { title: "[E2E] form-tri" }, orderBy: { createdAt: "desc" } });
    expect(t.status).toBe("A_TRIER");
  });

  test("UI : un modérateur voit la Boîte de tri", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    await page.goto("/admin/tri");
    await expect(page.getByRole("heading", { name: "Boîte de tri" })).toBeVisible();
  });
});
