import { test, expect } from "@playwright/test";
import { USERS, apiAuth, authPage } from "../helpers/auth.js";

test.describe("Administration & régressions UI", () => {
  test("régression : la modale Préférences s'affiche centrée (bug backdrop-filter de la topbar)", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    await page.goto("/admin/dashboard");

    await page.locator('button[title="Préférences de notification"]').click();
    const overlay = page.locator(".modal-overlay");
    await expect(overlay).toBeVisible();
    const modal = overlay.locator(".modal");
    await expect(modal.getByText("Préférences de notification")).toBeVisible();

    const box = await modal.boundingBox();
    const vp = page.viewportSize();
    // Le haut de la modale ne doit pas être tronqué et la modale tient dans la fenêtre.
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);
    // L'overlay (position:fixed) couvre tout l'écran → preuve qu'il n'est plus piégé dans la topbar.
    const obox = await overlay.boundingBox();
    expect(obox.width).toBeGreaterThan(vp.width * 0.9);
    expect(obox.height).toBeGreaterThan(vp.height * 0.9);
  });

  test("admin : sélecteur de responsable présent dans Services & entreprises", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    await page.goto("/admin/gestion");
    await page.getByRole("button", { name: "Services & entreprises" }).click();
    await expect(page.getByText("Responsable").first()).toBeVisible();
    await expect(page.locator(".group-grid select").first()).toBeVisible();
  });

  test("admin : créer puis supprimer un canal global", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.admin);
    await authPage(page, token);
    page.on("dialog", (d) => d.accept()); // confirmation de suppression
    await page.goto("/admin/chat");

    const name = `[E2E] Canal ${Date.now()}`;
    await page.locator(".chat-room.create", { hasText: "Créer un salon" }).click();
    await expect(page.locator(".modal-head", { hasText: "Créer un salon" })).toBeVisible();
    await page.locator(".modal input.input").fill(name);
    await page.getByRole("button", { name: /Créer le salon/ }).click();

    await expect(page.locator(".chat-room", { hasText: name })).toBeVisible();

    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.locator(".chat-room", { hasText: name })).toHaveCount(0);
  });
});
