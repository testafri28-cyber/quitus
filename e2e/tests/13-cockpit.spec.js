import { test, expect } from "@playwright/test";
import { API, bearer } from "../helpers/auth.js";
import { computeHealth } from "../../server/services/healthScore.js";

const SUPER = { email: "admin@quitus.ci", password: "superadmin123" };
const superLogin = async (request) => (await (await request.post(`${API}/api/superadmin/auth/login`, { data: SUPER })).json()).token;

test.describe("Console d'opérateur (cockpit, santé, impersonation)", () => {
  test("unité : computeHealth classe sain / à surveiller / à risque", async () => {
    const sain = computeHealth({ tickets30d: 42, tickets90dAvg: 38, daysSinceLastActivity: 0, openEscalations: 0, escalationsOver24h: 0, billingStatus: "up_to_date" });
    expect(sain.bucket).toBe("SAIN");
    expect(sain.score).toBeGreaterThanOrEqual(70);

    const watch = computeHealth({ tickets30d: 9, tickets90dAvg: 20, daysSinceLastActivity: 10, openEscalations: 1, escalationsOver24h: 0, billingStatus: "pending" });
    expect(watch.bucket).toBe("A_SURVEILLER");

    const risk = computeHealth({ tickets30d: 1, tickets90dAvg: 15, daysSinceLastActivity: 40, openEscalations: 2, escalationsOver24h: 1, billingStatus: "overdue" });
    expect(risk.bucket).toBe("A_RISQUE");
    expect(risk.score).toBeLessThan(40);
  });

  test("API : cockpit (KPIs + file d'attention + santé système + watchlist)", async ({ request }) => {
    const token = await superLogin(request);
    const ck = await (await request.get(`${API}/api/superadmin/cockpit`, { headers: bearer(token) })).json();
    expect(typeof ck.kpis.mrr).toBe("number");
    expect(typeof ck.kpis.overdueTotal).toBe("number");
    expect(Array.isArray(ck.attentionQueue)).toBeTruthy();
    expect(ck.systemHealth.webPush).toBeTruthy();
    // watchlist triée par score croissant
    const scores = ck.watchlist.map((w) => w.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  test("API : fiche 360° d'un compte à risque (score + 4 composantes)", async ({ request }) => {
    const token = await superLogin(request);
    const accounts = (await (await request.get(`${API}/api/superadmin/accounts?bucket=A_RISQUE`, { headers: bearer(token) })).json()).accounts;
    expect(accounts.length).toBeGreaterThan(0);
    const d = await (await request.get(`${API}/api/superadmin/accounts/${accounts[0].id}`, { headers: bearer(token) })).json();
    expect(d.health.score).toBeLessThan(40);
    for (const k of ["usage", "engagement", "support", "billing"]) expect(typeof d.health[k]).toBe("number");
    expect(d.usage.tickets30d).toBeDefined();
  });

  test("API : impersonation — jeton jetable, isolation, audit start/end", async ({ request }) => {
    const token = await superLogin(request);
    const accounts = (await (await request.get(`${API}/api/superadmin/accounts`, { headers: bearer(token) })).json()).accounts;

    // Compte relié (Groupe ABC) → impersonation possible
    const linked = accounts.find((a) => a.name === "Groupe ABC");
    const imp = await (await request.post(`${API}/api/superadmin/accounts/${linked.id}/impersonate`, { headers: bearer(token) })).json();
    expect(imp.token).toBeTruthy();

    // Le jeton ouvre une session FRONTOFFICE…
    expect((await request.get(`${API}/api/auth/me`, { headers: bearer(imp.token) })).status()).toBe(200);
    // …mais AUCUN accès backoffice
    expect((await request.get(`${API}/api/superadmin/stats`, { headers: bearer(imp.token) })).status()).toBe(403);

    // Fin de session (logue IMPERSONATION_END)
    expect((await request.post(`${API}/api/superadmin/impersonate/stop`, { headers: bearer(imp.token) })).status()).toBe(200);

    // Compte non relié (Beta Corp) → 409
    const unlinked = accounts.find((a) => a.name === "Beta Corp");
    expect((await request.post(`${API}/api/superadmin/accounts/${unlinked.id}/impersonate`, { headers: bearer(token) })).status()).toBe(409);

    // Audit : START + END présents
    const audit = (await (await request.get(`${API}/api/superadmin/audit`, { headers: bearer(token) })).json()).entries;
    const actions = audit.map((a) => a.action);
    expect(actions).toContain("IMPERSONATION_START");
    expect(actions).toContain("IMPERSONATION_END");
  });

  test("UI : cockpit chargé pour le SUPER_ADMIN", async ({ page, request }) => {
    const token = await superLogin(request);
    await page.addInitScript((t) => localStorage.setItem("quitus_super_token", t), token);
    await page.goto("/superadmin");
    await expect(page.getByRole("heading", { name: "Cockpit" })).toBeVisible();
    await expect(page.locator(".sa-kpi", { hasText: "Comptes à risque" })).toBeVisible();
    await expect(page.getByText("File d'attention")).toBeVisible();
    await expect(page.getByText("Santé système")).toBeVisible();
  });

  test("UI : bannière de consultation éditeur + sortie", async ({ page, request }) => {
    const token = await superLogin(request);
    const accounts = (await (await request.get(`${API}/api/superadmin/accounts`, { headers: bearer(token) })).json()).accounts;
    const linked = accounts.find((a) => a.name === "Groupe ABC");
    const imp = await (await request.post(`${API}/api/superadmin/accounts/${linked.id}/impersonate`, { headers: bearer(token) })).json();

    // On pose le jeton d'impersonation comme session frontoffice
    await page.addInitScript((t) => localStorage.setItem("ticket_token", t), imp.token);
    await page.goto("/");
    // Bannière visible avec le nom du client
    const banner = page.locator(".imp-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Groupe ABC");
    // Quitter → revient au login et efface la session
    await banner.getByRole("button", { name: "Quitter" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("UI : un utilisateur normal reste bloqué hors du backoffice", async ({ page }) => {
    await page.goto("/superadmin");
    await expect(page).toHaveURL(/\/superadmin\/login/);
  });

  // ---- Phase 2 : Adoption / Santé / Confiance ----
  test("API : adoption, ops et audit filtré", async ({ request }) => {
    const token = await superLogin(request);
    const ad = await (await request.get(`${API}/api/superadmin/adoption`, { headers: bearer(token) })).json();
    expect(typeof ad.kpis.conversionRate).toBe("number");
    expect(Array.isArray(ad.trialsToConvert)).toBeTruthy();
    expect(Array.isArray(ad.expansion)).toBeTruthy();
    expect(ad.planDistribution.length).toBe(4);

    const ops = await (await request.get(`${API}/api/superadmin/ops`, { headers: bearer(token) })).json();
    expect(ops.system.webPush).toBeTruthy();
    expect(Array.isArray(ops.escalations)).toBeTruthy();
    // escalades triées (les >24h d'abord)
    const over = ops.escalations.map((e) => e.over24h);
    expect(over).toEqual([...over].sort((a, b) => b - a));

    const filtered = await (await request.get(`${API}/api/superadmin/audit?action=tenant.update&limit=10`, { headers: bearer(token) })).json();
    expect(filtered.entries.every((e) => e.action === "tenant.update")).toBeTruthy();
  });

  test("UI : les 3 modules Phase 2 sont des pages complètes", async ({ page, request }) => {
    const token = await superLogin(request);
    await page.addInitScript((t) => localStorage.setItem("quitus_super_token", t), token);

    await page.goto("/superadmin/adoption");
    await expect(page.getByRole("heading", { name: "Adoption" })).toBeVisible();
    await expect(page.getByText("Essais à convertir")).toBeVisible();
    await expect(page.getByText("Répartition par plan")).toBeVisible();

    await page.goto("/superadmin/sante");
    await expect(page.getByRole("heading", { name: "Santé & exploitation" })).toBeVisible();
    await expect(page.getByText("État des services")).toBeVisible();

    await page.goto("/superadmin/confiance");
    await expect(page.getByRole("heading", { name: "Confiance & contrôle" })).toBeVisible();
    await expect(page.getByText("Contrôles de sécurité")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Journal d'audit" })).toBeVisible();
  });
});
