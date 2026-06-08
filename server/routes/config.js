// Configuration du routage/SLA — réservée à l'admin (tout en base, rien en dur).
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

const URGENCES = ["CRITIQUE", "URGENT", "NORMAL", "FAIBLE"];

// Vue d'ensemble : grille SLA, calendrier, fériés.
router.get("/", async (_req, res, next) => {
  try {
    const [sla, calendrier, feries] = await Promise.all([
      prisma.politiqueSLA.findMany({ where: { companyId: null } }),
      prisma.calendrierOuvre.findFirst({ where: { companyId: null } }),
      prisma.jourFerie.findMany({ where: { companyId: null }, orderBy: { date: "asc" } }),
    ]);
    const slaOrdered = URGENCES.map((u) => sla.find((s) => s.urgence === u) || { urgence: u, priseEnMainH: 0, rappelH: 0, escaladeH: 0 });
    res.json({ sla: slaOrdered, calendrier, feries });
  } catch (err) { next(err); }
});

const slaSchema = z.object({
  entries: z.array(z.object({
    urgence: z.enum(URGENCES),
    priseEnMainH: z.number().positive(), rappelH: z.number().positive(), escaladeH: z.number().positive(),
  })),
});
router.patch("/sla", async (req, res, next) => {
  try {
    const parsed = slaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    for (const s of parsed.data.entries) {
      const ex = await prisma.politiqueSLA.findFirst({ where: { companyId: null, urgence: s.urgence } });
      if (ex) await prisma.politiqueSLA.update({ where: { id: ex.id }, data: { priseEnMainH: s.priseEnMainH, rappelH: s.rappelH, escaladeH: s.escaladeH } });
      else await prisma.politiqueSLA.create({ data: { companyId: null, ...s } });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

const calSchema = z.object({
  jours: z.array(z.number().int().min(1).max(7)).min(1),
  heureDebut: z.string(), heureFin: z.string(),
  pauseDebut: z.string().nullable().optional(), pauseFin: z.string().nullable().optional(),
});
router.patch("/calendrier", async (req, res, next) => {
  try {
    const parsed = calSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const ex = await prisma.calendrierOuvre.findFirst({ where: { companyId: null } });
    const data = { ...parsed.data, pauseDebut: parsed.data.pauseDebut || null, pauseFin: parsed.data.pauseFin || null };
    const calendrier = ex
      ? await prisma.calendrierOuvre.update({ where: { id: ex.id }, data })
      : await prisma.calendrierOuvre.create({ data: { companyId: null, ...data } });
    res.json({ calendrier });
  } catch (err) { next(err); }
});

const ferieSchema = z.object({ date: z.string(), libelle: z.string().min(1) });
router.post("/ferie", async (req, res, next) => {
  try {
    const parsed = ferieSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const date = new Date(parsed.data.date + "T00:00:00.000Z");
    const ferie = await prisma.jourFerie.create({ data: { companyId: null, date, libelle: parsed.data.libelle } });
    res.status(201).json({ ferie });
  } catch (err) { next(err); }
});
router.delete("/ferie/:id", async (req, res, next) => {
  try { await prisma.jourFerie.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (err) { if (err.code === "P2025") return res.status(404).json({ error: "Introuvable." }); next(err); }
});

// Attribuer / retirer la permission de dispatch (modérateur).
router.patch("/dispatcher/:userId", async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { peutDispatcher: !!req.body.peutDispatcher },
      select: { id: true, peutDispatcher: true },
    });
    res.json({ user });
  } catch (err) { if (err.code === "P2025") return res.status(404).json({ error: "Utilisateur introuvable." }); next(err); }
});

export default router;
