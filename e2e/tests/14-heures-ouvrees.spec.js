import { test, expect } from "@playwright/test";
import { ajouterHeuresOuvrees, heuresOuvreesRestantes } from "../../server/services/heuresOuvrees.js";

// Calendrier de référence : lun→ven 08:00–16:30, pause 12:00–14:00 (6,5 h ouvrées/jour).
const CAL = { jours: [1, 2, 3, 4, 5], heureDebut: "08:00", heureFin: "16:30", pauseDebut: "12:00", pauseFin: "14:00" };
const U = (y, mo, d, h = 0, mi = 0) => new Date(Date.UTC(y, mo, d, h, mi));

test.describe("Heures ouvrées (pendule SLA)", () => {
  test("précondition : 2026-06-08 = lundi, 2026-06-12 = vendredi", () => {
    expect(U(2026, 5, 8).getUTCDay()).toBe(1);  // lundi
    expect(U(2026, 5, 12).getUTCDay()).toBe(5); // vendredi
  });

  test("traversée de la pause : 10:00 + 4 h → 16:00", () => {
    expect(ajouterHeuresOuvrees(U(2026, 5, 8, 10, 0), 4, CAL).getTime()).toBe(U(2026, 5, 8, 16, 0).getTime());
  });

  test("la pause n'est pas décomptée : 11:00 + 2 h → 15:00", () => {
    expect(ajouterHeuresOuvrees(U(2026, 5, 8, 11, 0), 2, CAL).getTime()).toBe(U(2026, 5, 8, 15, 0).getTime());
  });

  test("débordement sur le lendemain : 15:00 + 4 h → lendemain 10:30", () => {
    expect(ajouterHeuresOuvrees(U(2026, 5, 8, 15, 0), 4, CAL).getTime()).toBe(U(2026, 5, 9, 10, 30).getTime());
  });

  test("6,5 h ouvrées = même heure le prochain jour ouvré", () => {
    expect(ajouterHeuresOuvrees(U(2026, 5, 8, 9, 0), 6.5, CAL).getTime()).toBe(U(2026, 5, 9, 9, 0).getTime());
  });

  test("saut de week-end : vendredi 15:00 + 4 h → lundi 10:30", () => {
    expect(ajouterHeuresOuvrees(U(2026, 5, 12, 15, 0), 4, CAL).getTime()).toBe(U(2026, 5, 15, 10, 30).getTime());
  });

  test("saut d'un jour férié : mardi férié → lundi 15:00 + 4 h → mercredi 10:30", () => {
    const feries = ["2026-06-09"]; // mardi férié
    expect(ajouterHeuresOuvrees(U(2026, 5, 8, 15, 0), 4, CAL, feries).getTime()).toBe(U(2026, 5, 10, 10, 30).getTime());
  });

  test("dépôt hors plage (avant l'ouverture) : lundi 06:00 + 1 h → 09:00", () => {
    expect(ajouterHeuresOuvrees(U(2026, 5, 8, 6, 0), 1, CAL).getTime()).toBe(U(2026, 5, 8, 9, 0).getTime());
  });

  test("heures restantes : 10:00 → 16:00 = 4 h (pause exclue)", () => {
    expect(heuresOuvreesRestantes(U(2026, 5, 8, 10, 0), U(2026, 5, 8, 16, 0), CAL)).toBeCloseTo(4, 5);
  });
});
