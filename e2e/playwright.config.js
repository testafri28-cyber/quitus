import { defineConfig, devices } from "@playwright/test";

// Tests e2e Quitus. Prérequis : Postgres + backend (4000) + frontend (5173) déjà démarrés.
// workers:1 — base de données partagée + scénarios temps réel à 2 utilisateurs : on évite les courses.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 40_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.js",
  globalTeardown: "./global-teardown.js",
  use: {
    baseURL: "http://localhost:5173",
    actionTimeout: 12_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
