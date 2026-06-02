import { test, expect } from "@playwright/test";
import { onHoldMs, activeResolutionMs } from "../../server/services/metrics.js";

const H = 3600 * 1000;

// Vérifie de façon déterministe que le temps « En attente » est bien exclu du délai.
test.describe("Métriques — délai actif (hors temps d'attente)", () => {
  test("onHoldMs additionne les périodes passées en attente", () => {
    const events = [
      { detail: JSON.stringify({ from: "NEW", to: "IN_PROGRESS" }), createdAt: "2026-06-01T10:00:00Z" },
      { detail: JSON.stringify({ from: "IN_PROGRESS", to: "ON_HOLD" }), createdAt: "2026-06-01T11:00:00Z" },
      { detail: JSON.stringify({ from: "ON_HOLD", to: "IN_PROGRESS" }), createdAt: "2026-06-01T15:00:00Z" }, // 4 h en attente
      { detail: JSON.stringify({ from: "IN_PROGRESS", to: "RESOLVED" }), createdAt: "2026-06-01T16:00:00Z" },
    ];
    expect(onHoldMs(events)).toBe(4 * H);
  });

  test("plusieurs pauses cumulées", () => {
    const events = [
      { detail: JSON.stringify({ to: "ON_HOLD" }), createdAt: "2026-06-01T10:00:00Z" },
      { detail: JSON.stringify({ to: "IN_PROGRESS" }), createdAt: "2026-06-01T11:00:00Z" }, // 1 h
      { detail: JSON.stringify({ to: "ON_HOLD" }), createdAt: "2026-06-01T12:00:00Z" },
      { detail: JSON.stringify({ to: "IN_PROGRESS" }), createdAt: "2026-06-01T14:00:00Z" }, // 2 h
    ];
    expect(onHoldMs(events)).toBe(3 * H);
  });

  test("activeResolutionMs = délai brut − attente", () => {
    const ticket = { createdAt: "2026-06-01T10:00:00Z", resolvedAt: "2026-06-01T16:00:00Z" }; // 6 h brut
    const events = [
      { detail: JSON.stringify({ to: "ON_HOLD" }), createdAt: "2026-06-01T11:00:00Z" },
      { detail: JSON.stringify({ to: "IN_PROGRESS" }), createdAt: "2026-06-01T15:00:00Z" }, // 4 h de pause
    ];
    expect(activeResolutionMs(ticket, events)).toBe(2 * H); // 6 h − 4 h
  });

  test("sans pause, le délai actif = délai brut", () => {
    const ticket = { createdAt: "2026-06-01T10:00:00Z", resolvedAt: "2026-06-01T13:00:00Z" };
    expect(activeResolutionMs(ticket, [])).toBe(3 * H);
  });
});
