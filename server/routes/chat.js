import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessRoom, canManageRoom } from "../services/chat.js";

const router = Router();

const roomInclude = { department: { select: { id: true, name: true, responsibleId: true } } };

// Upload de pièce jointe (mêmes règles que les tickets : stockage local, 10 Mo max).
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/chat/upload — dépose un fichier et renvoie son URL (à joindre ensuite via chat:send)
router.post("/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
});

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

// GET /api/chat/unread — nombre de messages non lus par salon accessible (pour le badge « Discussion »)
router.get("/unread", requireAuth, async (req, res, next) => {
  try {
    const all = await prisma.chatRoom.findMany({ include: roomInclude });
    const rooms = all.filter((r) => !r.archived && canAccessRoom(req.user, r));
    if (!rooms.length) return res.json({ counts: {}, total: 0 });

    const reads = await prisma.chatRead.findMany({
      where: { userId: req.user.id, roomId: { in: rooms.map((r) => r.id) } },
      select: { roomId: true, lastReadAt: true },
    });
    const readMap = Object.fromEntries(reads.map((r) => [r.roomId, r.lastReadAt]));
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { createdAt: true } });
    const baseline = me?.createdAt || new Date(0);

    const counts = {};
    let total = 0;
    for (const r of rooms) {
      const since = readMap[r.id] || baseline;
      const n = await prisma.chatMessage.count({
        where: { roomId: r.id, authorId: { not: req.user.id }, createdAt: { gt: since } },
      });
      if (n > 0) { counts[r.id] = n; total += n; }
    }
    res.json({ counts, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/rooms/:id/read — marquer un salon comme lu (avance le marqueur de lecture)
router.post("/rooms/:id/read", requireAuth, async (req, res, next) => {
  try {
    const room = await prisma.chatRoom.findUnique({ where: { id: req.params.id }, include: roomInclude });
    if (!room) return res.status(404).json({ error: "Salon introuvable." });
    if (!canAccessRoom(req.user, room)) return res.status(403).json({ error: "Accès refusé à ce salon." });
    await prisma.chatRead.upsert({
      where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
      update: { lastReadAt: new Date() },
      create: { userId: req.user.id, roomId: room.id },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/rooms — créer un salon
//  - canal global : admin uniquement (scope:"GLOBAL", name requis)
//  - salon de service : responsable du service (le sien) ou admin (n'importe quel service)
const createSchema = z.object({
  name: z.string().optional(),
  departmentId: z.string().optional(),
  scope: z.enum(["GLOBAL", "DEPARTMENT"]).optional(),
});
router.post("/rooms", requireAuth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètres invalides." });
    const isAdmin = req.user.role === "ADMIN";

    // Canal global (admin seulement)
    if (parsed.data.scope === "GLOBAL") {
      if (!isAdmin) return res.status(403).json({ error: "Réservé à l'administrateur." });
      const name = parsed.data.name?.trim();
      if (!name) return res.status(400).json({ error: "Nom du canal requis." });
      const room = await prisma.chatRoom.create({ data: { name, scope: "GLOBAL" } });
      return res.status(201).json({ room });
    }

    // Salon de service
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
    // Un canal global n'est gérable que par l'admin (canManageRoom le garantit) ; un salon de service par son responsable ou l'admin.
    if (!canManageRoom(req.user, room)) return res.status(403).json({ error: "Réservé au responsable du service ou à l'administrateur." });
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
