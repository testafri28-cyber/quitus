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
