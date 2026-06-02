import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessRoom, canManageRoom } from "../services/chat.js";

const router = Router();

const roomInclude = { department: { select: { id: true, name: true, responsibleId: true } } };

// GET /api/chat/rooms — salons accessibles + droits
router.get("/rooms", requireAuth, async (req, res, next) => {
  try {
    const all = await prisma.chatRoom.findMany({ include: roomInclude, orderBy: [{ scope: "asc" }, { name: "asc" }] });
    const rooms = all
      .filter((r) => canAccessRoom(req.user, r))
      .map((r) => ({
        id: r.id,
        name: r.name,
        scope: r.scope,
        departmentId: r.departmentId,
        department: r.department ? { id: r.department.id, name: r.department.name } : null,
        archived: r.archived,
        canManage: canManageRoom(req.user, r),
      }));

    // L'utilisateur peut-il créer le salon de son service ? (responsable + pas encore de salon)
    let canCreateDeptRoom = false;
    if (req.user.role !== "ADMIN" && req.user.departmentId) {
      const dep = await prisma.department.findUnique({ where: { id: req.user.departmentId }, include: { chatRoom: true } });
      canCreateDeptRoom = !!dep && dep.responsibleId === req.user.id && !dep.chatRoom;
    }
    res.json({ rooms, canCreateDeptRoom });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/rooms — créer le salon d'un service (responsable du service ou admin)
const createSchema = z.object({ name: z.string().optional(), departmentId: z.string().optional() });
router.post("/rooms", requireAuth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètres invalides." });
    const isAdmin = req.user.role === "ADMIN";
    const departmentId = isAdmin ? parsed.data.departmentId : req.user.departmentId;
    if (!departmentId) return res.status(400).json({ error: "Service introuvable." });

    const dep = await prisma.department.findUnique({ where: { id: departmentId }, include: { chatRoom: true } });
    if (!dep) return res.status(404).json({ error: "Service introuvable." });
    if (!isAdmin && dep.responsibleId !== req.user.id) {
      return res.status(403).json({ error: "Réservé au responsable du service." });
    }
    if (dep.chatRoom) return res.status(409).json({ error: "Ce service a déjà un salon." });

    const room = await prisma.chatRoom.create({
      data: { name: parsed.data.name?.trim() || dep.name, scope: "DEPARTMENT", departmentId: dep.id },
    });
    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chat/rooms/:id — renommer / archiver (responsable ou admin)
const patchSchema = z.object({ name: z.string().min(1).optional(), archived: z.boolean().optional() });
router.patch("/rooms/:id", requireAuth, async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètres invalides." });
    const room = await prisma.chatRoom.findUnique({ where: { id: req.params.id }, include: roomInclude });
    if (!room) return res.status(404).json({ error: "Salon introuvable." });
    if (!canManageRoom(req.user, room)) return res.status(403).json({ error: "Réservé au responsable du service." });
    const updated = await prisma.chatRoom.update({ where: { id: room.id }, data: parsed.data });
    res.json({ room: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chat/rooms/:id — supprimer le salon (responsable ou admin ; salon global non supprimable)
router.delete("/rooms/:id", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.chatRoom.findUnique({ where: { id: req.params.id }, include: roomInclude });
    if (!room) return res.status(404).json({ error: "Salon introuvable." });
    if (room.scope === "GLOBAL") return res.status(400).json({ error: "Le salon général ne peut pas être supprimé." });
    if (!canManageRoom(req.user, room)) return res.status(403).json({ error: "Réservé au responsable du service." });
    await prisma.chatRoom.delete({ where: { id: room.id } }); // messages supprimés en cascade
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/rooms/:id/messages — historique
router.get("/rooms/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.chatRoom.findUnique({ where: { id: req.params.id }, include: roomInclude });
    if (!room) return res.status(404).json({ error: "Salon introuvable." });
    if (!canAccessRoom(req.user, room)) return res.status(403).json({ error: "Accès refusé à ce salon." });
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: room.id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ messages, canManage: canManageRoom(req.user, room) });
  } catch (err) {
    next(err);
  }
});

export default router;
