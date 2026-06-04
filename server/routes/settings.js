import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

// Valeurs par défaut + typage (booléens stockés en "true"/"false").
const DEFAULTS = { suggestionsEnabled: true };

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    suggestionsEnabled: map.suggestionsEnabled != null ? map.suggestionsEnabled === "true" : DEFAULTS.suggestionsEnabled,
  };
}

// --- Marque (couleurs personnalisables par l'admin) ---
const HEX = /^#[0-9a-fA-F]{6}$/;
const BRAND_DEFAULTS = { accent: "#6e62b6", accentWca: "#378add", accentIdc: "#ef9f27" };

export async function getBranding() {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["brand_accent", "brand_accent_wca", "brand_accent_idc"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    accent: map.brand_accent || BRAND_DEFAULTS.accent,
    accentWca: map.brand_accent_wca || BRAND_DEFAULTS.accentWca,
    accentIdc: map.brand_accent_idc || BRAND_DEFAULTS.accentIdc,
  };
}

// GET /api/settings/branding — PUBLIC (la page de connexion, pré-auth, en a besoin)
router.get("/branding", async (_req, res, next) => {
  try {
    res.json({ branding: await getBranding() });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings/branding — admin
const brandSchema = z.object({
  accent: z.string().regex(HEX).optional(),
  accentWca: z.string().regex(HEX).optional(),
  accentIdc: z.string().regex(HEX).optional(),
});
const BRAND_KEY = { accent: "brand_accent", accentWca: "brand_accent_wca", accentIdc: "brand_accent_idc" };
router.patch("/branding", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = brandSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Couleur invalide (format #RRGGBB attendu)." });
    for (const [field, val] of Object.entries(parsed.data)) {
      const key = BRAND_KEY[field];
      await prisma.setting.upsert({ where: { key }, update: { value: val }, create: { key, value: val } });
    }
    // Synchronise la couleur des entreprises WCA/IDC → badges (EmitterBadge), KPI, etc. suivent.
    if (parsed.data.accentWca) await prisma.company.updateMany({ where: { slug: "wca" }, data: { color: parsed.data.accentWca } });
    if (parsed.data.accentIdc) await prisma.company.updateMany({ where: { slug: "idc" }, data: { color: parsed.data.accentIdc } });
    res.json({ branding: await getBranding() });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings — lisible par tout utilisateur authentifié (le formulaire en a besoin)
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings — admin
const schema = z.object({ suggestionsEnabled: z.boolean().optional() });
router.patch("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètre invalide." });
    for (const [key, val] of Object.entries(parsed.data)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) },
      });
    }
    res.json({ settings: await getSettings() });
  } catch (err) {
    next(err);
  }
});

export default router;
