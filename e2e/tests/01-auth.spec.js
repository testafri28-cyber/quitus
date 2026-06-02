import { test, expect } from "@playwright/test";
import { USERS, loginUI } from "../helpers/auth.js";

test.describe("Authentification", () => {
  test("redirige vers /login quand on n'est pas connecté", async ({ page }) => {
    await page.goto("/global/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("refuse un mauvais mot de passe", async ({ page }) => {
    await loginUI(page, USERS.admin, "mauvais-mdp");
    await expect(page.locator(".error-box")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("connexion admin → accès à la Gestion", async ({ page }) => {
    await loginUI(page, USERS.admin);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator(".nav-item", { hasText: "Gestion" })).toBeVisible();
  });

  test("connexion membre puis déconnexion", async ({ page }) => {
    await loginUI(page, USERS.boti);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator(".nav-item", { hasText: "Discussion" })).toBeVisible();
    await page.locator('button[title="Déconnexion"]').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
