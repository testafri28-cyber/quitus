import { test, expect } from "@playwright/test";
import { API, USERS, apiAuth, authPage, bearer, getDepartments } from "../helpers/auth.js";

test.describe("Améliorations d'utilité", () => {
  test("recherche globale : list?q filtre par titre / référence", async ({ request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");

    const marker = "ZQX"; // marqueur improbable pour isoler ce ticket
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: `[E2E] Recherche ${marker} unique`, description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();

    // Recherche par fragment de titre
    const byTitle = await (await request.get(`${API}/api/tickets?q=${marker}&pageSize=8`, { headers: bearer(token) })).json();
    expect(byTitle.tickets.some((t) => t.id === ticket.id)).toBeTruthy();
    expect(byTitle.tickets.length).toBeLessThanOrEqual(8);

    // Recherche par référence exacte
    const byRef = await (await request.get(`${API}/api/tickets?q=${encodeURIComponent(ticket.reference)}`, { headers: bearer(token) })).json();
    expect(byRef.tickets.some((t) => t.id === ticket.id)).toBeTruthy();

    // Pagination : champs présents
    expect(typeof byTitle.total).toBe("number");
    expect(typeof byTitle.pages).toBe("number");
  });

  test("la barre de recherche de la topbar ouvre un panneau et navigue vers la demande", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    const marker = "WVZ";
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: `[E2E] Topbar ${marker}`, description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();

    await authPage(page, token);
    await page.goto("/global/dashboard");

    await page.locator(".search .icon-btn").click();
    await page.locator(".ts-box input").fill(marker);
    const item = page.locator(".ts-item", { hasText: `Topbar ${marker}` });
    await expect(item.first()).toBeVisible();
    await item.first().click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}`));
  });

  test("besoin lié résolu → notification de déblocage au porteur du ticket parent", async ({ request }) => {
    const { token: tBoti, user: boti } = await apiAuth(request, USERS.boti); // agent IT (porteur du parent)
    const { token: tYapo, user: yapo } = await apiAuth(request, USERS.yapo); // membre IT (résout le besoin)
    const it = (await getDepartments(request, tBoti)).find((d) => d.name === "Informatique");

    // Ticket parent porté par Boti (il le prend en main)
    const parent = (await (await request.post(`${API}/api/tickets`, {
      headers: bearer(tBoti),
      data: { title: "[E2E] Parent bloqué", description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    })).json()).ticket;
    await request.patch(`${API}/api/tickets/${parent.id}/assign`, { headers: bearer(tBoti), data: { assignedToId: boti.id } });
    await request.patch(`${API}/api/tickets/${parent.id}/status`, { headers: bearer(tBoti), data: { status: "IN_PROGRESS" } });

    // Besoin lié (enfant) rattaché au parent
    const child = (await (await request.post(`${API}/api/tickets`, {
      headers: bearer(tBoti),
      data: { title: "[E2E] Besoin lié", description: "x", type: "NEED", space: "GLOBAL", departmentId: it.id, parentId: parent.id },
    })).json()).ticket;

    // Yapo prend et résout le besoin lié
    await request.patch(`${API}/api/tickets/${child.id}/assign`, { headers: bearer(tYapo), data: { assignedToId: yapo.id } });
    await request.patch(`${API}/api/tickets/${child.id}/status`, { headers: bearer(tYapo), data: { status: "IN_PROGRESS" } });
    await request.patch(`${API}/api/tickets/${child.id}/status`, { headers: bearer(tYapo), data: { status: "RESOLVED" } });

    // Boti reçoit une notification de déblocage référençant le parent
    const notifs = await (await request.get(`${API}/api/notifications`, { headers: bearer(tBoti) })).json();
    const unblock = notifs.notifications.find((n) => n.ticketId === parent.id && /repren/i.test(n.text || ""));
    expect(unblock, "notification de déblocage attendue").toBeTruthy();
  });

  test("le demandeur modifie sa demande tant qu'elle n'est pas prise en main", async ({ request }) => {
    const { token: tAya, user: aya } = await apiAuth(request, USERS.aya);
    const { token: tBoti, user: boti } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, tBoti)).find((d) => d.name === "Informatique");

    const ticket = (await (await request.post(`${API}/api/tickets`, {
      headers: bearer(tAya),
      data: { title: "[E2E] Demande à corriger", description: "version 1", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    })).json()).ticket;

    // Correction par le demandeur → 200
    const edit = await request.patch(`${API}/api/tickets/${ticket.id}`, {
      headers: bearer(tAya), data: { title: "[E2E] Demande corrigée", description: "version 2" },
    });
    expect(edit.status()).toBe(200);
    expect((await edit.json()).ticket.title).toBe("[E2E] Demande corrigée");

    // Un autre utilisateur ne peut pas modifier (403)
    const other = await request.patch(`${API}/api/tickets/${ticket.id}`, { headers: bearer(tBoti), data: { title: "pirate" } });
    expect(other.status()).toBe(403);

    // Une fois prise en main → le demandeur ne peut plus modifier (409)
    await request.patch(`${API}/api/tickets/${ticket.id}/assign`, { headers: bearer(tBoti), data: { assignedToId: boti.id } });
    const late = await request.patch(`${API}/api/tickets/${ticket.id}`, { headers: bearer(tAya), data: { description: "trop tard" } });
    expect(late.status()).toBe(409);
  });

  test("auteur modifie / supprime son commentaire ; un autre ne peut pas", async ({ request }) => {
    const { token: tBoti } = await apiAuth(request, USERS.boti);
    const { token: tYapo } = await apiAuth(request, USERS.yapo);
    const it = (await getDepartments(request, tBoti)).find((d) => d.name === "Informatique");

    const ticket = (await (await request.post(`${API}/api/tickets`, {
      headers: bearer(tBoti),
      data: { title: "[E2E] Commentaires", description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    })).json()).ticket;

    const comment = (await (await request.post(`${API}/api/tickets/${ticket.id}/comments`, {
      headers: bearer(tBoti), data: { content: "commentaire initial", isInternal: true },
    })).json()).comment;

    // L'auteur modifie → 200 + editedAt renseigné
    const edit = await request.patch(`${API}/api/tickets/${ticket.id}/comments/${comment.id}`, {
      headers: bearer(tBoti), data: { content: "commentaire modifié" },
    });
    expect(edit.status()).toBe(200);
    const edited = (await edit.json()).comment;
    expect(edited.content).toBe("commentaire modifié");
    expect(edited.editedAt).toBeTruthy();

    // Un collègue ne peut pas modifier le commentaire d'autrui (403)
    const hack = await request.patch(`${API}/api/tickets/${ticket.id}/comments/${comment.id}`, {
      headers: bearer(tYapo), data: { content: "détournement" },
    });
    expect(hack.status()).toBe(403);

    // L'auteur supprime → 200 ; il disparaît du ticket
    const del = await request.delete(`${API}/api/tickets/${ticket.id}/comments/${comment.id}`, { headers: bearer(tBoti) });
    expect(del.status()).toBe(200);
    const after = await (await request.get(`${API}/api/tickets/${ticket.id}`, { headers: bearer(tBoti) })).json();
    expect(after.ticket.comments.some((c) => c.id === comment.id)).toBeFalsy();
  });
});
