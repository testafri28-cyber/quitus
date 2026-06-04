import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { USERS, openAs } from "../helpers/auth.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const composer = (page) => page.getByPlaceholder("Écrire un message…");
const sendBtn = (page) => page.locator(".chat-composer .btn-primary");

async function openRoom(page, name) {
  await page.goto("/global/chat");
  await page.locator(".chat-room", { hasText: name }).first().click();
  await expect(page.locator(".chat-head")).toContainText(name);
}

test.describe("Discussion — temps réel, mentions, pièces jointes", () => {
  test("un message arrive en temps réel chez l'autre utilisateur", async ({ browser, request }) => {
    const a = await openAs(browser, request, USERS.boti);
    const b = await openAs(browser, request, USERS.yapo);
    await openRoom(a.page, "Salon général");
    await openRoom(b.page, "Salon général");

    const txt = `[E2E] live ${Date.now()}`;
    await composer(a.page).fill(txt);
    await sendBtn(a.page).click();

    await expect(b.page.locator(".cm-bubble", { hasText: txt })).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test("une mention @ notifie le destinataire dans la cloche", async ({ browser, request }) => {
    const a = await openAs(browser, request, USERS.boti);
    const b = await openAs(browser, request, USERS.yapo);
    await openRoom(a.page, "Salon général");
    await b.page.goto("/global/dashboard"); // Yapo n'est PAS dans le chat

    const input = composer(a.page);
    await input.fill("@Yapo");
    await expect(a.page.locator(".mention-menu")).toBeVisible();
    await a.page.locator(".mention-item", { hasText: "Yapo" }).first().click();
    await input.pressSequentially(" [E2E] tu peux voir ?");
    await sendBtn(a.page).click();

    // surbrillance côté émetteur
    await expect(a.page.locator(".cm-bubble .mention").last()).toBeVisible();
    // cloche côté destinataire + symbole « @ » sur l'item Discussion
    await expect(b.page.locator(".notif .icon-btn .notif-dot")).toBeVisible();
    await expect(b.page.locator(".nav-item", { hasText: "Discussion" }).locator(".nav-at")).toBeVisible();
    await b.page.locator(".notif .icon-btn").click();
    await expect(b.page.locator(".notif-item", { hasText: "mentionné" })).toBeVisible();

    await a.context.close();
    await b.context.close();
  });

  test("pièce jointe dans un message + report vers un ticket", async ({ browser, request }) => {
    const a = await openAs(browser, request, USERS.boti);
    await openRoom(a.page, "Salon général");

    await a.page.locator('.ca-btn input[type="file"]').setInputFiles(path.join(here, "../fixtures/sample.txt"));
    await expect(a.page.locator(".chat-attach-pending")).toContainText("sample.txt");

    await composer(a.page).fill("[E2E] voici la pièce jointe");
    await sendBtn(a.page).click();

    const msg = a.page.locator(".chat-msg", { hasText: "[E2E] voici la pièce jointe" }).last();
    await expect(msg.locator(".cm-attach", { hasText: "sample.txt" })).toBeVisible();

    // Convertir le message en ticket → le formulaire reprend la pièce jointe
    await msg.locator(".cm-actions button", { hasText: "Ticket" }).click();
    await expect(a.page).toHaveURL(/\/form/);
    await expect(a.page.getByText("Pièce jointe reportée du salon")).toBeVisible();

    await a.context.close();
  });
});
