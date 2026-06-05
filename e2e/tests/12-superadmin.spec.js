import { test, expect } from "@playwright/test";
import { API, USERS, apiLogin, bearer } from "../helpers/auth.js";

// Pré-requis : seed du backoffice (npm run seed:superadmin) → crée le compte éditeur
// admin@quitus.ci / superadmin123 (table SuperAdmin) + 3 tenants de démo.
const SUPER = { email: "admin@quitus.ci", password: "superadmin123" };
const SUPER_TOKEN_KEY = "quitus_super_token";

// Connexion au backoffice via SA PROPRE route (séparée du frontoffice).
async function superLogin(request) {
  const res = await request.post(`${API}/api/superadmin/auth/login`, { data: SUPER });
  expect(res.ok(), "login backoffice").toBeTruthy();
  return (await res.json()).token;
}
// Injecte la session backoffice (clé localStorage distincte de ticket_token).
const injectSuper = (page, token) => page.addInitScript(([k, t]) => localStorage.setItem(k, t), [SUPER_TOKEN_KEY, token]);

test.describe("Backoffice SaaS (éditeur) — authentification séparée", () => {
  test("API : login dédié + isolation totale frontoffice/backoffice", async ({ request }) => {
    const token = await superLogin(request);

    // /auth/me du backoffice
    const me = await (await request.get(`${API}/api/superadmin/auth/me`, { headers: bearer(token) })).json();
    expect(me.admin.email).toBe(SUPER.email);

    // stats + revenus accessibles
    const stats = await (await request.get(`${API}/api/superadmin/stats`, { headers: bearer(token) })).json();
    expect(typeof stats.tenants.total).toBe("number");
    expect(typeof stats.mrr).toBe("number");
    expect(typeof stats.collectedThisMonth).toBe("number"); // encaissé réel ce mois (≠ MRR)

    const rev = await (await request.get(`${API}/api/superadmin/revenue`, { headers: bearer(token) })).json();
    expect(rev.arr).toBe(rev.mrr * 12);
    expect(rev.payments6months.length).toBe(6);
    expect(typeof rev.churnRate).toBe("number");

    // Catalogue tarifaire des plans (base du MRR)
    const plans = await (await request.get(`${API}/api/superadmin/plans`, { headers: bearer(token) })).json();
    expect(plans.plans.length).toBe(4);
    expect(plans.plans.find((p) => p.plan === "PME").monthly_fcfa).toBeGreaterThan(0);

    // Changement de mot de passe : mauvais mot de passe actuel → 400
    const badPwd = await request.patch(`${API}/api/superadmin/auth/password`, { headers: bearer(token), data: { currentPassword: "FAUX", newPassword: "nouveau-mdp-123" } });
    expect(badPwd.status()).toBe(400);

    // Mauvais mot de passe au login → 401
    const bad = await request.post(`${API}/api/superadmin/auth/login`, { data: { email: SUPER.email, password: "x" } });
    expect(bad.status()).toBe(401);

    // Un jeton FRONTOFFICE ne donne AUCUN accès au backoffice (scope différent) → 403
    const memberTok = await apiLogin(request, USERS.boti);
    const cross = await request.get(`${API}/api/superadmin/stats`, { headers: bearer(memberTok) });
    expect(cross.status()).toBe(403);

    // Un jeton BACKOFFICE ne donne AUCUN accès au frontoffice → 401
    const cross2 = await request.get(`${API}/api/auth/me`, { headers: bearer(token) });
    expect(cross2.status()).toBe(401);

    // Sans jeton → 401
    expect((await request.get(`${API}/api/superadmin/tenants`)).status()).toBe(401);
  });

  test("UI : sans session backoffice, /superadmin redirige vers le login dédié", async ({ page }) => {
    await page.goto("/superadmin");
    await expect(page).toHaveURL(/\/superadmin\/login/);
    await expect(page.locator(".sa-login-card")).toBeVisible();
    await expect(page.getByText("Espace éditeur")).toBeVisible();
    // Ce login est distinct de celui du client (pas de page client).
    await expect(page.getByText(/distincte de l'espace client/)).toBeVisible();
  });

  test("UI : connexion via le formulaire dédié → tableau de bord", async ({ page }) => {
    await page.goto("/superadmin/login");
    await page.locator('input[type="email"]').fill(SUPER.email);
    await page.locator('input[type="password"]').fill(SUPER.password);
    await page.locator(".sa-login-card .btn-primary").click();

    await expect(page).toHaveURL(/\/superadmin$/);
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.locator(".sa-kpi", { hasText: "MRR" })).toBeVisible();

    // Navigation vers les clients
    await page.locator(".sa-nav", { hasText: "Clients" }).click();
    await expect(page).toHaveURL(/\/superadmin\/tenants/);
    await expect(page.locator(".sa-table")).toBeVisible();
  });

  test("UI : session backoffice injectée → accès direct au dashboard", async ({ page, request }) => {
    const token = await superLogin(request);
    await injectSuper(page, token);
    await page.goto("/superadmin");
    await expect(page.locator(".sa-side", { hasText: "Backoffice éditeur" })).toBeVisible();
    await expect(page.locator(".sa-kpi", { hasText: "Clients actifs" })).toBeVisible();
  });
});
