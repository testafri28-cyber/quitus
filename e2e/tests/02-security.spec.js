import { test, expect } from "@playwright/test";
import { API, USERS, apiAuth, apiLogin, bearer, getDepartments, getRooms } from "../helpers/auth.js";

// Failles potentielles : on vérifie que le backend applique bien les droits, même si l'UI les cache.
test.describe("Sécurité / contrôle d'accès (API)", () => {
  test("sans token → 401", async ({ request }) => {
    expect((await request.get(`${API}/api/tickets`)).status()).toBe(401);
    expect((await request.get(`${API}/api/notifications`)).status()).toBe(401);
  });

  test("un membre WCA ne peut pas émettre dans l'espace IDC (403)", async ({ request }) => {
    const t = await apiLogin(request, USERS.koffi);
    const r = await request.post(`${API}/api/tickets`, {
      headers: bearer(t),
      data: { title: "[E2E] cross-space", description: "x", type: "NEED", space: "IDC", category: "Informatique" },
    });
    expect(r.status()).toBe(403);
  });

  test("l'audit est réservé à l'admin (403 pour un membre)", async ({ request }) => {
    const t = await apiLogin(request, USERS.boti);
    expect((await request.get(`${API}/api/audit`, { headers: bearer(t) })).status()).toBe(403);
  });

  test("un membre ne peut pas modifier un utilisateur (403)", async ({ request }) => {
    const { token, user } = await apiAuth(request, USERS.boti);
    const r = await request.patch(`${API}/api/users/${user.id}`, { headers: bearer(token), data: { role: "ADMIN" } });
    expect(r.status()).toBe(403);
  });

  test("Koffi (WCA) ne peut pas lire l'historique du salon IT (403)", async ({ request }) => {
    const tk = await apiLogin(request, USERS.koffi);
    const ta = await apiLogin(request, USERS.admin);
    const rooms = await getRooms(request, ta);
    const it = rooms.find((r) => r.scope === "DEPARTMENT" && r.department?.name === "Informatique");
    expect(it, "salon IT introuvable").toBeTruthy();
    const r = await request.get(`${API}/api/chat/rooms/${it.id}/messages`, { headers: bearer(tk) });
    expect(r.status()).toBe(403);
  });

  test("un membre non responsable ne peut pas gérer une équipe (403)", async ({ request }) => {
    const ty = await apiLogin(request, USERS.yapo);
    const ta = await apiLogin(request, USERS.admin);
    const it = (await getDepartments(request, ta)).find((d) => d.name === "Informatique");
    const r = await request.get(`${API}/api/departments/${it.id}/candidates`, { headers: bearer(ty) });
    expect(r.status()).toBe(403);
  });

  test("injection : attachmentUrl hors /uploads est ignorée à la création de ticket", async ({ request }) => {
    const t = await apiLogin(request, USERS.boti);
    const it = (await getDepartments(request, t)).find((d) => d.name === "Informatique");
    const r = await request.post(`${API}/api/tickets`, {
      headers: bearer(t),
      data: { title: "[E2E] injection", description: "x", type: "NEED", space: "GLOBAL", departmentId: it.id, attachmentUrl: "http://evil.example/secret" },
    });
    expect(r.status()).toBe(201);
    expect((await r.json()).ticket.attachmentUrl).toBeFalsy();
  });

  test("anti-vol : un collègue ne peut pas changer le statut d'un ticket assigné à un autre (403)", async ({ request }) => {
    const ta = await apiLogin(request, USERS.admin);
    const { token: tBoti, user: boti } = await apiAuth(request, USERS.boti);
    const tYapo = await apiLogin(request, USERS.yapo);
    const it = (await getDepartments(request, ta)).find((d) => d.name === "Informatique");

    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(tBoti),
      data: { title: "[E2E] anti-vol", description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();
    // Boti prend la main (s'assigne lui-même)
    const a = await request.patch(`${API}/api/tickets/${ticket.id}/assign`, { headers: bearer(tBoti), data: { assignedToId: boti.id } });
    expect(a.status()).toBe(200);
    // Yapo (même service, mais pas l'assigné) tente de résoudre → refusé
    const r = await request.patch(`${API}/api/tickets/${ticket.id}/status`, { headers: bearer(tYapo), data: { status: "RESOLVED" } });
    expect(r.status()).toBe(403);
  });
});
