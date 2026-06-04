import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { activeResolutionMs, groupEventsByTicket } from "../services/metrics.js";

const router = Router();

const ROLES = ["MEMBER", "ADMIN"];

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  companyId: true,
  departmentId: true,
  createdAt: true,
  company: { select: { id: true, name: true, slug: true, color: true } },
  department: { select: { id: true, name: true, code: true } },
};

// GET /api/users/presence — disponibilité déclarée de tous les utilisateurs (tout authentifié).
// L'état « en ligne / pas en ligne » est calculé côté client à partir des événements socket.
router.get("/presence", requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, presence: true } });
    res.json({ presences: users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users — admin: tous (filtrable) ; agent: agents de SON service.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { role, departmentId, companyId } = req.query;
    const where = {};

    if (req.user.role === "ADMIN") {
      if (role && ROLES.includes(role)) where.role = role;
      if (departmentId) where.departmentId = departmentId;
      if (companyId) where.companyId = companyId;
    } else {
      // Un membre ne peut lister que les membres de son propre service.
      where.departmentId = req.user.departmentId;
    }

    const users = await prisma.user.findMany({ where, select: userSelect, orderBy: { name: "asc" } });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/stats — performance par utilisateur (admin)
//  - demandes soumises, interventions (tickets pris en charge), délai moyen de résolution
router.get("/stats", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const [users, bySubmitter, byAssignee, resolved, byTaken] = await Promise.all([
      prisma.user.findMany({ where: { role: "MEMBER" }, select: userSelect, orderBy: { name: "asc" } }),
      prisma.ticket.groupBy({ by: ["submittedById"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["assignedToId"], _count: { _all: true } }),
      prisma.ticket.findMany({
        where: { assignedToId: { not: null }, resolvedAt: { not: null } },
        select: { id: true, assignedToId: true, createdAt: true, resolvedAt: true },
      }),
      // « Pris en main » : événements d'audit où le membre s'est assigné lui-même.
      prisma.ticketEvent.groupBy({
        by: ["actorId"],
        where: { action: "assigned", detail: { contains: '"self":true' } },
        _count: { _all: true },
      }),
    ]);

    const subMap = Object.fromEntries(bySubmitter.map((r) => [r.submittedById, r._count._all]));
    const asgMap = Object.fromEntries(byAssignee.filter((r) => r.assignedToId).map((r) => [r.assignedToId, r._count._all]));
    const takenMap = Object.fromEntries(byTaken.filter((r) => r.actorId).map((r) => [r.actorId, r._count._all]));

    // Événements de statut des tickets résolus → temps « En attente » à exclure du délai.
    const resolvedIds = resolved.map((r) => r.id);
    const statusEvents = resolvedIds.length
      ? await prisma.ticketEvent.findMany({ where: { action: "status", ticketId: { in: resolvedIds } }, select: { ticketId: true, detail: true, createdAt: true } })
      : [];
    const evByTicket = groupEventsByTicket(statusEvents);

    const perUser = users.map((u) => {
      const mine = resolved.filter((r) => r.assignedToId === u.id);
      const avgMs = mine.length
        ? mine.reduce((s, t) => s + activeResolutionMs(t, evByTicket[t.id] || []), 0) / mine.length
        : null;
      return {
        id: u.id,
        name: u.name,
        company: u.company,
        department: u.department,
        submitted: subMap[u.id] || 0,
        interventions: asgMap[u.id] || 0,
        taken: takenMap[u.id] || 0,
        resolvedCount: mine.length,
        avgInterventionHours: avgMs != null ? +(avgMs / 36e5).toFixed(1) : null,
      };
    });

    res.json({ perUser });
  } catch (err) {
    next(err);
  }
});

// POST /api/users — création (admin)
const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum."),
  role: z.enum(ROLES).default("MEMBER"),
  companyId: z.string().min(1, "Entreprise requise."),
  departmentId: z.string().nullable().optional(),
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { name, email, password, role, companyId, departmentId } = parsed.data;

    // Tout membre appartient à un service (pour voir/traiter la file de ce service).
    if (role === "MEMBER" && !departmentId) {
      return res.status(400).json({ error: "Un membre doit être rattaché à un service." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        companyId,
        departmentId: departmentId || null,
      },
      select: userSelect,
    });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cet email est déjà utilisé." });
    if (err.code === "P2003") return res.status(400).json({ error: "Entreprise ou service invalide." });
    next(err);
  }
});

// PATCH /api/users/:id — mise à jour (admin)
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  companyId: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  password: z.string().min(6, "Mot de passe : 6 caractères minimum.").optional(), // réinitialisation par l'admin
});

router.patch("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { password, ...rest } = parsed.data;
    const data = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect,
    });
    // Si le membre quitte un service dont il était responsable, on libère cette responsabilité.
    if (parsed.data.departmentId !== undefined || parsed.data.role === "ADMIN") {
      const where = user.departmentId
        ? { responsibleId: user.id, id: { not: user.departmentId } } // garde la responsabilité de son service actuel
        : { responsibleId: user.id }; // plus aucun service → on libère partout
      await prisma.department.updateMany({ where, data: { responsibleId: null } });
    }
    res.json({ user });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Utilisateur introuvable." });
    next(err);
  }
});

// DELETE /api/users/:id — suppression (admin, pas soi-même)
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Impossible de supprimer son propre compte." });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Utilisateur introuvable." });
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Utilisateur lié à des tickets : réassignez-les avant suppression." });
    }
    next(err);
  }
});

export default router;
