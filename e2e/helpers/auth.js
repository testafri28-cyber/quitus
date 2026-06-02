import { expect } from "@playwright/test";

// API en 127.0.0.1 (évite la résolution IPv6 capricieuse de Node) ; le front est servi par Vite sur localhost:5173.
export const API = "http://127.0.0.1:4000";
export const PASSWORD = "password123";

export const USERS = {
  admin: "adnan.moghnieh@idc.ci",       // ADMIN
  boti: "boti.raoul@idc.ci",            // IT (responsable)
  yapo: "yapo.arthur@idc.ci",           // IT (membre)
  koffi: "employe.wca@wca.ci",          // WCA (Logistique, responsable)
  aya: "employe.idc@idc.ci",            // IDC (Réseau)
  jacqueline: "eboule.jacqueline@wca.ci", // WCA (RH)
};

// Connexion via l'API → { token, user }.
export async function apiAuth(request, email, password = PASSWORD) {
  const res = await request.post(`${API}/api/auth/login`, { data: { email, password } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return res.json();
}
export async function apiLogin(request, email, password = PASSWORD) {
  return (await apiAuth(request, email, password)).token;
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

// Injecte le token JWT en localStorage avant tout chargement de page (auth sans passer par l'écran de login).
export async function authPage(page, token) {
  await page.addInitScript((t) => localStorage.setItem("ticket_token", t), token);
}

// Ouvre une page authentifiée dans un contexte navigateur isolé (utile pour 2 utilisateurs simultanés).
export async function openAs(browser, request, email) {
  const { token, user } = await apiAuth(request, email);
  const context = await browser.newContext();
  const page = await context.newPage();
  await authPage(page, token);
  return { context, page, token, user };
}

// Connexion réelle via l'écran de login (teste le formulaire).
export async function loginUI(page, email, password = PASSWORD) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

// Helpers de découverte de données via l'API (services, salons).
export async function getDepartments(request, token) {
  return (await (await request.get(`${API}/api/departments`, { headers: bearer(token) })).json()).departments;
}
export async function getRooms(request, token) {
  return (await (await request.get(`${API}/api/chat/rooms`, { headers: bearer(token) })).json()).rooms;
}
