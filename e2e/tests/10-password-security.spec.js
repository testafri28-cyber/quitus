import { test, expect } from "@playwright/test";
import { API, USERS, apiLogin, bearer, getDepartments } from "../helpers/auth.js";

const login = (request, email, password) =>
  request.post(`${API}/api/auth/login`, { data: { email, password } });

test.describe("Mots de passe & sécurité", () => {
  test("en-têtes de sécurité (Helmet) présents", async ({ request }) => {
    const r = await request.get(`${API}/health`);
    expect(r.status()).toBe(200);
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("réinit admin + changement par l'utilisateur", async ({ request }) => {
    const adminTok = await apiLogin(request, USERS.admin);
    const it = (await getDepartments(request, adminTok)).find((d) => d.name === "Informatique");

    // utilisateur jetable
    const email = "e2e.pwtest@idc.ci";
    const companies = await (await request.get(`${API}/api/departments/companies`, { headers: bearer(adminTok) })).json();
    const idc = companies.companies.find((c) => c.slug === "idc");
    await request.post(`${API}/api/users`, {
      headers: bearer(adminTok),
      data: { name: "[E2E] pwtest", email, password: "password123", role: "MEMBER", companyId: idc.id, departmentId: it.id },
    });

    // 1) Réinitialisation par l'admin → connexion avec le nouveau mdp
    const reset = await request.patch(`${API}/api/users/${(await (await request.get(`${API}/api/users`, { headers: bearer(adminTok) })).json()).users.find((u) => u.email === email).id}`, {
      headers: bearer(adminTok), data: { password: "resetByAdmin1" },
    });
    expect(reset.status()).toBe(200);
    expect((await login(request, email, "resetByAdmin1")).status()).toBe(200);
    expect((await login(request, email, "password123")).status()).toBe(401); // ancien mdp invalide

    // 2) L'utilisateur change lui-même son mot de passe
    const tok = (await (await login(request, email, "resetByAdmin1")).json()).token;
    const bad = await request.patch(`${API}/api/auth/password`, { headers: bearer(tok), data: { currentPassword: "FAUX", newPassword: "selfChosen2" } });
    expect(bad.status()).toBe(400); // mauvais mdp actuel refusé
    const ok = await request.patch(`${API}/api/auth/password`, { headers: bearer(tok), data: { currentPassword: "resetByAdmin1", newPassword: "selfChosen2" } });
    expect(ok.status()).toBe(200);
    expect((await login(request, email, "selfChosen2")).status()).toBe(200);
  });
});
