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

  // Un élément est-il entièrement dans le viewport (gauche ≥ 0 et droite ≤ largeur) ?
  const inViewport = (loc) => loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0;
  });

  test("le panneau de notifications tient dans l'écran", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    await page.goto("/admin/dashboard");
    await page.locator(".notif .icon-btn").click();
    const panel = page.locator(".notif-panel");
    await expect(panel).toBeVisible();
    expect(await inViewport(panel), "panneau notif dans l'écran").toBeTruthy();
    // le titre du panneau est visible (côté gauche non rogné)
    await expect(panel.getByText("Notifications")).toBeVisible();
  });

  test("les modales (Mon compte, préférences) tiennent dans l'écran", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    await page.goto("/admin/dashboard");

    await page.locator('.icon-btn[title="Préférences de notification"]').click();
    const prefs = page.locator(".modal");
    await expect(prefs).toBeVisible();
    expect(await inViewport(prefs), "modale préférences dans l'écran").toBeTruthy();
    await page.locator('.modal .icon-btn[title="Fermer"]').click();

    await page.locator(".topbar-burger").click();
    await page.locator(".nav-item", { hasText: "Mon compte" }).click();
    const acct = page.locator(".modal");
    await expect(acct).toBeVisible();
    expect(await inViewport(acct), "modale Mon compte dans l'écran").toBeTruthy();
  });

  test("le filtre « Type » ouvert garde toutes ses options dans l'écran (petit téléphone)", async ({ page, request }) => {
    await page.setViewportSize({ width: 360, height: 640 }); // hauteur où le menu se collait au bas
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/dashboard");

    await page.locator(".filter-btn", { hasText: "Type" }).click();
    const opts = page.locator(".filter-menu .filter-opt");
    const n = await opts.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const ok = await opts.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
      });
      expect(ok, `option de filtre ${i} entièrement visible`).toBeTruthy();
    }
  });

  test("en-tête de discussion : les actions de gestion restent dans l'écran", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti); // responsable IT → salon géré
    await authPage(page, token);
    await page.goto("/global/chat");
    // ouvre un salon offrant des actions de gestion
    const rooms = page.locator(".chat-room");
    const n = await rooms.count();
    for (let i = 0; i < n; i++) {
      await rooms.nth(i).click();
      if (await page.locator(".chat-head .btn").count()) break;
    }
    const btns = page.locator(".chat-head .btn");
    const count = await btns.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      expect(await inViewport(btns.nth(i)), `bouton de gestion ${i} dans l'écran`).toBeTruthy();
    }
  });
});
