import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications/preferences — préférences de l'utilisateur courant
router.get("/preferences", requireAuth, async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { notifyEmail: true, notifyPush: true } });
    res.json({ preferences: u });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/preferences
const prefSchema = z.object({ notifyEmail: z.boolean().optional(), notifyPush: z.boolean().optional() });
router.patch("/preferences", requireAuth, async (req, res, next) => {
  try {
    const parsed = prefSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Préférence invalide." });
    const u = await prisma.user.update({ where: { id: req.user.id }, data: parsed.data, select: { notifyEmail: true, notifyPush: true } });
    res.json({ preferences: u });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications — notifications de l'utilisateur courant + nombre de non-lus
router.get("/", requireAuth, async (req, res, next) => {
  try {
    // Les messages de salon ne passent PAS par la cloche : ils sont signalés dans la barre latérale (badge « Discussion »).
    const where = { userId: req.user.id, type: { not: "chat" } };
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { ticket: { select: { id: true, reference: true } } },
      }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);
    res.json({ notifications, unread });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all — tout marquer comme lu
router.post("/read-all", requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read — marquer une notification comme lue
router.post("/:id/read", requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
