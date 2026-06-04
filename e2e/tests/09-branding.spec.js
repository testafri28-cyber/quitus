import { test, expect } from "@playwright/test";
import { API, USERS, apiLogin, bearer } from "../helpers/auth.js";

test.describe("Marque / personnalisation des couleurs", () => {
  test("le branding est public (page de connexion)", async ({ request }) => {
    const r = await request.get(`${API}/api/settings/branding`);
    expect(r.status()).toBe(200);
    expect((await r.json()).branding).toHaveProperty("accent");
  });

  test("un membre ne peut pas changer la marque (403) ; hex invalide refusé (400)", async ({ request }) => {
    const member = await apiLogin(request, USERS.boti);
    expect((await request.patch(`${API}/api/settings/branding`, { headers: bearer(member), data: { accent: "#123456" } })).status()).toBe(403);
    const admin = await apiLogin(request, USERS.admin);
    expect((await request.patch(`${API}/api/settings/branding`, { headers: bearer(admin), data: { accent: "rouge" } })).status()).toBe(400);
  });

  test("l'admin change la couleur → appliquée (login re-thématisé), puis reset", async ({ page, request }) => {
    const admin = await apiLogin(request, USERS.admin);
    // couleur distinctive
    const r = await request.patch(`${API}/api/settings/branding`, { headers: bearer(admin), data: { accent: "#c81e6f" } });
    expect(r.status()).toBe(200);
    expect((await r.json()).branding.accent).toBe("#c81e6f");

    // la page de connexion (publique) doit utiliser la nouvelle couleur sur le bouton
    await page.goto("/login");
    await expect(page.locator(".lg-btn")).toBeVisible();
    await page.waitForTimeout(700); // laisse BrandProvider charger + injecter le thème
    const accentVar = await page.locator(".lg-btn").evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim().toLowerCase());
    expect(accentVar).toBe("#c81e6f");

    // reset par défaut
    const back = await request.patch(`${API}/api/settings/branding`, { headers: bearer(admin), data: { accent: "#6e62b6", accentWca: "#378add", accentIdc: "#ef9f27" } });
    expect((await back.json()).branding.accent).toBe("#6e62b6");
  });
});
