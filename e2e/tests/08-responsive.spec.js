import { test, expect } from "@playwright/test";
import { USERS, apiAuth, authPage } from "../helpers/auth.js";

// Vue mobile : la sidebar devient un tiroir, ouvert par le bouton hamburger.
test.describe("Responsive (mobile)", () => {
  test.use({ viewport: { width: 390, height: 820 } });

  test("hamburger ouvre le tiroir et la navigation fonctionne", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    await page.goto("/admin/dashboard");

    // Le hamburger est visible en mobile ; le badge entreprise est masqué.
    const burger = page.locator(".topbar-burger");
    await expect(burger).toBeVisible();
    await expect(page.locator(".company-badge")).toBeHidden();

    // Tiroir fermé au départ → on l'ouvre.
    await expect(page.locator(".app.mobile-nav-open")).toHaveCount(0);
    await burger.click();
    await expect(page.locator(".app.mobile-nav-open")).toHaveCount(1);

    // Naviguer via le tiroir ferme celui-ci et change d'écran.
    await page.locator(".nav-item", { hasText: "Discussion" }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.locator(".app.mobile-nav-open")).toHaveCount(0);
  });

  test("le tableau de bord reste utilisable (liste scrollable)", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/dashboard");
    // La page ne déborde pas horizontalement le viewport.
    const docW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docW).toBeLessThanOrEqual(390 + 1);
  });

  test("en mobile, la liste de tickets passe en cartes (toutes les infos visibles)", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/dashboard");

    // L'en-tête de colonnes du tableau est masqué (mode cartes).
    await expect(page.locator(".t-head")).toBeHidden();

    // La première carte affiche son statut ET sa date, sans débordement horizontal.
    const row = page.locator(".t-row").first();
    await expect(row).toBeVisible();
    await expect(row.locator(".stat")).toBeVisible();      // statut visible
    await expect(row.locator(".t-date")).toBeVisible();    // date visible
    const within = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.right <= window.innerWidth + 1;
    });
    expect(within, "la carte ne déborde pas du viewport").toBeTruthy();
  });
});
