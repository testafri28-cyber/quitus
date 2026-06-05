import { test, expect } from "@playwright/test";
import { API, USERS, apiLogin, apiAuth, authPage, bearer, getDepartments } from "../helpers/auth.js";

const login = (request, email, password) =>
  request.post(`${API}/api/auth/login`, { data: { email, password } });

test.describe("Mots de passe & sécurité", () => {
  test("en-têtes de sécurité (Helmet) présents", async ({ request }) => {
    const r = await request.get(`${API}/health`);
    expect(r.status()).toBe(200);
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("la sidebar ouvre « Mon compte » (profil, disponibilité, mot de passe)", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/dashboard");
    await page.locator(".nav-item", { hasText: "Mon compte" }).click();
    const modal = page.locator(".modal", { hasText: "Mon compte" });
    await expect(modal).toBeVisible();
    // Récapitulatif de profil (lecture seule)
    await expect(modal.locator(".acct-cell", { hasText: "Rôle" })).toContainText("Membre");
    await expect(modal.locator(".acct-cell", { hasText: "Service" })).toContainText("Informatique");
    await expect(modal.locator(".acct-cell", { hasText: "Entreprise" })).toBeVisible();
    await expect(modal.locator(".acct-cell", { hasText: "Membre depuis" })).toBeVisible();
    // Disponibilité + nom modifiable + mot de passe
    await expect(modal.getByText("Ma disponibilité")).toBeVisible();
    await expect(modal.getByText("Nom affiché")).toBeVisible();
    await expect(modal.getByText("Changer mon mot de passe")).toBeVisible();
    await expect(modal.getByPlaceholder("Mot de passe actuel")).toBeVisible();
  });

  test("profil : l'utilisateur modifie son propre nom (UI + persistance)", async ({ page, request }) => {
    // Compte jetable pour ne pas renommer un utilisateur réel.
    const adminTok = await apiLogin(request, USERS.admin);
    const it = (await getDepartments(request, adminTok)).find((d) => d.name === "Informatique");
    const companies = await (await request.get(`${API}/api/departments/companies`, { headers: bearer(adminTok) })).json();
    const idc = companies.companies.find((c) => c.slug === "idc");
    const email = "e2e.profil@idc.ci";
    // (idempotent) crée le compte s'il n'existe pas
    await request.post(`${API}/api/users`, {
      headers: bearer(adminTok),
      data: { name: "[E2E] Profil", email, password: "password123", role: "MEMBER", companyId: idc.id, departmentId: it.id },
    });

    const { token } = await apiAuth(request, email);
    await authPage(page, token);
    await page.goto("/global/dashboard");
    await page.locator(".nav-item", { hasText: "Mon compte" }).click();
    const modal = page.locator(".modal", { hasText: "Mon compte" });
    await expect(modal).toBeVisible();

    const newName = `[E2E] Profil ${Date.now()}`;
    const input = modal.locator(".input").first();
    await input.fill(newName);
    await modal.getByRole("button", { name: "Enregistrer" }).click();
    await expect(modal.getByText("Nom mis à jour.")).toBeVisible();

    // Persistance côté serveur
    const me = await (await request.get(`${API}/api/auth/me`, { headers: bearer(token) })).json();
    expect(me.user.name).toBe(newName);

    // Validation : un nom trop court est refusé (400)
    const bad = await request.patch(`${API}/api/auth/profile`, { headers: bearer(token), data: { name: "a" } });
    expect(bad.status()).toBe(400);
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
