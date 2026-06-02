import { test, expect } from "@playwright/test";
import { API, USERS, apiAuth, authPage, bearer, getDepartments } from "../helpers/auth.js";

test.describe("Tickets — création & cycle de vie", () => {
  test("création d'une demande via le formulaire", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/form");

    await page.locator("input.input").fill("[E2E] Demande via formulaire");

    // Sélecteur de service (composant custom)
    await page.locator(".picker-trigger").click();
    await page.locator(".picker-search input").fill("Informatique");
    await page.locator(".pick-item", { hasText: "Informatique" }).first().click();

    await page.locator("textarea.textarea").fill("[E2E] Description de test détaillée.");
    await page.getByRole("button", { name: /Soumettre la demande/ }).click();

    await expect(page.getByText("Demande soumise avec succès.")).toBeVisible();
  });

  test("cycle de vie : prendre la main → marquer résolu → clôturer", async ({ page, request }) => {
    const { token, user: boti } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    // Ticket créé via l'API (rapide & fiable), puis piloté dans l'UI.
    const cr = await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: "[E2E] Cycle de vie", description: "x", type: "INTERVENTION", space: "GLOBAL", departmentId: it.id },
    });
    const { ticket } = await cr.json();

    await authPage(page, token);
    await page.goto(`/global/tickets/${ticket.id}`);

    await expect(page.getByText("[E2E] Cycle de vie")).toBeVisible();
    // NEW + non assigné → bouton « Prendre la main »
    const take = page.getByRole("button", { name: "Prendre la main" });
    await expect(take).toBeVisible();
    await take.click();

    // Devient IN_PROGRESS → bouton suivant « Marquer résolu »
    const resolve = page.getByRole("button", { name: "Marquer résolu" });
    await expect(resolve).toBeVisible();
    await resolve.click();

    // RESOLVED → bouton suivant « Clôturer »
    await expect(page.getByRole("button", { name: "Clôturer" })).toBeVisible();
  });

  test("la demande créée apparaît dans le tableau de bord", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    const it = (await getDepartments(request, token)).find((d) => d.name === "Informatique");
    await request.post(`${API}/api/tickets`, {
      headers: bearer(token),
      data: { title: "[E2E] Visible dashboard", description: "x", type: "NEED", space: "GLOBAL", departmentId: it.id },
    });
    await authPage(page, token);
    await page.goto("/global/dashboard");
    await expect(page.getByText("[E2E] Visible dashboard")).toBeVisible();
  });
});
