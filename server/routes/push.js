import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { vapidPublicKey, pushEnabled } from "../services/push.js";

const router = Router();

// GET /api/push/public-key — clé publique VAPID (pour s'abonner côté navigateur)
router.get("/public-key", requireAuth, (_req, res) => {
  res.json({ key: vapidPublicKey(), enabled: pushEnabled });
});

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// POST /api/push/subscribe — enregistre l'abonnement du navigateur courant
router.post("/subscribe", requireAuth, async (req, res, next) => {
  try {
    const parsed = subSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Abonnement invalide." });
    const { endpoint, keys } = parsed.data;
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.status(201).json({ id: sub.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/push/unsubscribe — supprime l'abonnement
router.post("/unsubscribe", requireAuth, async (req, res, next) => {
  try {
    const endpoint = req.body?.endpoint;
    if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
