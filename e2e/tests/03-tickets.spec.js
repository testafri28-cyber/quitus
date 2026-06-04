import { test, expect } from "@playwright/test";
import { API, USERS, apiAuth, authPage, bearer, getDepartments } from "../helpers/auth.js";

test.describe("Tickets — création & cycle de vie", () => {
  test("création d'une demande via le formulaire", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/form");

    await page.locator("input.input").fill("[E2E] Demande via formulaire");

    // Sélecteur de service (composant custom)
    await page.locator(".picker-trigger").click();
    await page.locator(".picker-search input").fill("Informatique");
    await page.locator(".pick-item", { hasText: "Informatique" }).first().click();

    await page.locator("textarea.textarea").fill("[E2E] Description de test détaillée.");
    await page.getByRole("button", { name: /Soumettre la demande/ }).click();

    await expect(page.getByText("Demande soumise avec succès.")).toBeVisible();
  });

  test("cycle de vie : prendre la main → marquer résolu → clôturer", async ({ page, request }) => {
    const { token, user: boti } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    // Ticket créé via l'API (rapide & fiable), puis piloté dans l'UI.
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: "[E2E] Cycle de vie", description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();

    await authPage(page, token);
    await page.goto(`/global/tickets/${ticket.id}`);

    await expect(page.getByText("[E2E] Cycle de vie")).toBeVisible();
    // NEW + non assigné → bouton « Prendre la main »
    const take = page.getByRole("button", { name: "Prendre la main" });
    await expect(take).toBeVisible();
    await take.click();

    // Devient IN_PROGRESS → bouton suivant « Marquer résolu »
    const resolve = page.getByRole("button", { name: "Marquer résolu" });
    await expect(resolve).toBeVisible();
    await resolve.click();

    // RESOLVED → bouton suivant « Clôturer »
    await expect(page.getByRole("button", { name: "Clôturer" })).toBeVisible();
  });

  test("agent : message au demandeur + mise en attente", async ({ page, request }) => {
    const { token: tAya, user: aya } = await apiAuth(request, USERS.aya);   // demandeur
    const { token: tBoti, user: boti } = await apiAuth(request, USERS.boti); // agent IT
    const it = (await getDepartments(request, tBoti)).find((d) => d.name === "Informatique");

    // Aya (Réseau/IDC) crée une demande vers le service IT
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(tAya),
      data: { title: "[E2E] besoin d'infos", description: "manque de contexte", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();
    // Boti prend la main
    await request.patch(`${API}/api/tickets/${ticket.id}/assign`, { headers: bearer(tBoti), data: { assignedToId: boti.id } });

    // UI Boti : écrire AU demandeur
    await authPage(page, tBoti);
    await page.goto(`/global/tickets/${ticket.id}`);
    await page.getByRole("button", { name: "Message au demandeur" }).click();
    await page.locator("textarea.textarea").fill("[E2E] Pouvez-vous préciser le modèle exact ?");
    await page.locator(".comment-box .btn-primary").click();
    await expect(page.locator(".c-bubble", { hasText: "[E2E] Pouvez-vous préciser" })).toBeVisible();

    // Mettre en attente → le bouton suivant devient « Reprendre »
    await page.getByRole("button", { name: "Mettre en attente du demandeur" }).click();
    await expect(page.getByRole("button", { name: "Reprendre" })).toBeVisible();

    // Côté demandeur (API) : le message public est visible + notification reçue
    const seen = await (await request.get(`${API}/api/tickets/${ticket.id}`, { headers: bearer(tAya) })).json();
    expect(seen.ticket.comments.some((c) => c.content.includes("[E2E] Pouvez-vous préciser") && !c.isInternal)).toBeTruthy();
    const notifs = await (await request.get(`${API}/api/notifications`, { headers: bearer(tAya) })).json();
    expect(notifs.notifications.some((n) => n.type === "comment" && n.ticketId === ticket.id)).toBeTruthy();
  });

  test("besoin lié : créer depuis un ticket en attente + trace de dépendance", async ({ page, request }) => {
    const { token, user: boti } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: "[E2E] parent bloqué", description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket: parent } = await cr.json();
    await request.patch(`${API}/api/tickets/${parent.id}/assign`, { headers: bearer(token), data: { assignedToId: boti.id } });

    await authPage(page, token);
    await page.goto(`/global/tickets/${parent.id}`);
    await page.getByRole("button", { name: "Créer un besoin lié" }).click();
    await expect(page).toHaveURL(/\/form\?/);
    await expect(page.locator(".link-banner")).toContainText(parent.reference);

    await page.locator("input.input").fill("[E2E] besoin bloquant");
    await page.locator(".picker-trigger").click();
    await page.locator(".picker-search input").fill("Informatique");
    await page.locator(".pick-item", { hasText: "Informatique" }).first().click();
    await page.locator("textarea.textarea").fill("[E2E] description du besoin");
    await page.getByRole("button", { name: /Soumettre la demande/ }).click();
    await expect(page.getByText("Demande soumise avec succès.")).toBeVisible();

    // Trace : le ticket parent référence désormais le besoin lié.
    const seen = await (await request.get(`${API}/api/tickets/${parent.id}`, { headers: bearer(token) })).json();
    expect(seen.ticket.children.some((c) => c.title === "[E2E] besoin bloquant")).toBeTruthy();
  });

  test("notif de commentaire : focus=comments défile vers les commentaires", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: "[E2E] focus commentaires", description: "x", type: "NEED", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();
    await authPage(page, token);
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto(`/global/tickets/${ticket.id}?focus=comments`);
    await expect(page.locator("#comments")).toBeInViewport({ timeout: 6000 });
  });

  test("la demande créée apparaît dans le tableau de bord", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: "[E2E] Visible dashboard", description: "x", type: "NEED", space: "GLOBAL", departmentId: it.id },
    });
    await authPage(page, token);
    await page.goto("/global/dashboard");
    await expect(page.getByText("[E2E] Visible dashboard")).toBeVisible();
  });
});
