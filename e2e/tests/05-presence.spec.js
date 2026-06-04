import { test, expect } from "@playwright/test";
import { USERS, apiAuth, authPage, openAs } from "../helpers/auth.js";

test.describe("Présence & badge de discussion", () => {
  test("déclarer « En congé » persiste après rechargement", async ({ page, request }) => {
    const { token } = await apiAuth(request, USERS.boti);
    await authPage(page, token);
    await page.goto("/global/chat");

    const sel = page.locator(".pres-select");
    await expect(sel).toBeVisible();
    await sel.selectOption("ON_LEAVE");
    await page.reload();
    await expect(page.locator(".pres-select")).toHaveValue("ON_LEAVE");
  });

  test("le badge « Discussion » de la sidebar apparaît sur un nouveau message", async ({ browser, request }) => {
    const a = await openAs(browser, request, USERS.boti);
    const b = await openAs(browser, request, USERS.yapo);

    await b.page.goto("/global/dashboard"); // Yapo en ligne mais hors du chat
    await b.page.waitForTimeout(900);        // laisse le socket se connecter
    await a.page.goto("/global/chat");
    await a.page.locator(".chat-room", { hasText: "Salon général" }).first().click();

    const txt = `[E2E] ping sidebar ${Date.now()}`;
    await a.page.getByPlaceholder("Écrire un message…").fill(txt);
    await a.page.locator(".chat-composer .btn-primary").click();

    const chatNav = b.page.locator(".nav-item", { hasText: "Discussion" });
    // Indicateur de non-lus : compteur, ou « @ » si une mention est en attente.
    await expect(chatNav.locator(".nav-badge, .nav-at")).toBeVisible();

    await a.context.close();
    await b.context.close();
  });
});
