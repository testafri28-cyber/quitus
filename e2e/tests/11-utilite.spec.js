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
});
