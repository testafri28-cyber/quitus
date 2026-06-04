import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { UPLOAD_DIR } from "../lib/uploads.js";
import { resolveServiceCode, userCanUseSpace, SPACES } from "../services/routing.js";
import {
  notifyTicketCreated,
  notifyStatusChanged,
  notifyTicketClosed,
} from "../services/email.js";
import { notify, serviceMemberIds, STATUS_LABELS } from "../services/notify.js";
import { getSettings } from "./settings.js";
import { logEvent } from "../services/audit.js";

const router = Router();

const STATUSES = ["NEW", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];
const URGENCIES = ["NORMAL", "HIGH", "URGENT"];
const TYPES = ["INTERVENTION", "NEED"];

/* ---------------- Upload de pièce jointe ---------------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

/* ---------------- Helpers ---------------- */

// Visibilité : admin = tout ; sinon ses propres demandes + toutes celles de son service.
function visibilityWhere(user) {
  if (user.role === "ADMIN") return {};
  const or = [{ submittedById: user.id }];
  if (user.departmentId) or.push({ departmentId: user.departmentId });
  return { OR: or };
}

function canSeeTicket(user, ticket) {
  if (user.role === "ADMIN") return true;
  return ticket.submittedById === user.id || ticket.departmentId === user.departmentId;
}

// Droit d'intervenir (prendre la main, changer le statut, commenter en interne) :
// tout membre du service destinataire — ou l'admin.
function canActOnTicket(user, ticket) {
  return user.role === "ADMIN" || ticket.departmentId === user.departmentId;
}

async function nextReference() {
  const count = await prisma.ticket.count();
  return `TCK-${String(count + 1).padStart(6, "0")}`;
}

const ticketInclude = {
  submitter: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  suggestedTo: { select: { id: true, name: true } },
  transferTo: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, code: true, companyId: true } },
  sourceCompany: { select: { id: true, name: true, slug: true, color: true } },
  feedback: true,
  parent: { select: { id: true, reference: true, title: true, status: true } },
  children: { select: { id: true, reference: true, title: true, status: true, type: true }, orderBy: { createdAt: "asc" } },
};

/* ---------------- GET /api/tickets ---------------- */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, urgency, type, space, from, to, q, departmentId, company } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const where = { ...visibilityWhere(req.user) };

    if (status && STATUSES.includes(status)) where.status = status;
    if (urgency && URGENCIES.includes(urgency)) where.urgency = urgency;
    if (type && TYPES.includes(type)) where.type = type;
    if (space && SPACES.includes(space)) where.sourceSpace = space;

    // Filtres réservés à l'admin (les autres rôles sont déjà restreints).
    if (req.user.role === "ADMIN") {
      if (departmentId) where.departmentId = departmentId;
      if (company) {
        const c = await prisma.company.findUnique({ where: { slug: company } });
        if (c) where.sourceCompanyId = c.id;
      }
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ tickets, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

/* ---------------- GET /api/tickets/:id ---------------- */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        ...ticketInclude,
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (!canSeeTicket(req.user, ticket)) {
      return res.status(403).json({ error: "Accès refusé à ce ticket." });
    }
    // Le demandeur extérieur au service ne voit pas les commentaires internes.
    if (!canActOnTicket(req.user, ticket)) {
      ticket.comments = ticket.comments.filter((c) => !c.isInternal);
    }
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});

/* ---------------- POST /api/tickets ---------------- */
/* ---------------- GET /api/tickets/:id/events — journal du ticket ---------------- */
router.get("/:id/events", requireAuth, async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (!canSeeTicket(req.user, ticket)) return res.status(403).json({ error: "Accès refusé à ce ticket." });
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: ticket.id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  title: z.string().min(3, "Titre trop court.").max(200),
  description: z.string().min(1, "Description requise."),
  category: z.string().optional(), // libellé (routage indirect) — facultatif si departmentId fourni
  departmentId: z.string().optional(), // service destinataire choisi directement (modèle Quitus)
  suggestedToId: z.string().optional(), // membre suggéré (indication douce)
  type: z.enum(TYPES),
  urgency: z.enum(URGENCIES).default("NORMAL"),
  space: z.enum(SPACES).default("GLOBAL"),
  leaveStart: z.string().optional(),
  leaveEnd: z.string().optional(),
  leaveKind: z.string().optional(),
  attachmentUrl: z.string().optional(), // réutilisation d'un fichier déjà uploadé (ex. pièce jointe d'un message de salon)
  parentId: z.string().optional(), // besoin créé pour débloquer un ticket en attente (lien de dépendance)
});

// Un service est-il accessible depuis l'espace ? (GLOBAL = tout ; sinon commun + entreprise de l'espace)
function departmentVisibleInSpace(dept, space) {
  if (space === "GLOBAL") return true;
  if (!dept.companyId) return true; // service commun
  return dept.company?.slug === space.toLowerCase();
}

router.post("/", requireAuth, upload.single("attachment"), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { title, description, category, departmentId, suggestedToId, type, urgency, space, leaveStart, leaveEnd, leaveKind } = parsed.data;
    const reusedAttachment = parsed.data.attachmentUrl && parsed.data.attachmentUrl.startsWith("/uploads/") ? parsed.data.attachmentUrl : null;

    // Contrôle d'accès par espace : un employé WCA ne peut pas soumettre via l'espace IDC.
    if (!userCanUseSpace(req.user, space)) {
      return res.status(403).json({ error: `Accès refusé à l'espace ${space}.` });
    }

    // Résolution du service destinataire : par id (direct) ou via le libellé de catégorie.
    let department;
    if (departmentId) {
      department = await prisma.department.findUnique({ where: { id: departmentId }, include: { company: true } });
    } else if (category) {
      const code = resolveServiceCode(category);
      department = await prisma.department.findUnique({ where: { code }, include: { company: true } });
    }
    if (!department) {
      return res.status(400).json({ error: "Service destinataire introuvable." });
    }

    // Le service doit être accessible depuis l'espace courant.
    if (!departmentVisibleInSpace(department, space)) {
      return res.status(400).json({ error: "Ce service n'est pas disponible dans cet espace." });
    }

    const categoryLabel = category || department.name;

    // Suggestion douce : le membre suggéré doit appartenir au service destinataire.
    // Ignorée si la fonctionnalité est désactivée par l'admin.
    const settings = await getSettings();
    let suggested = null;
    if (suggestedToId && settings.suggestionsEnabled) {
      const m = await prisma.user.findUnique({ where: { id: suggestedToId } });
      if (!m || m.departmentId !== department.id) {
        return res.status(400).json({ error: "Le membre suggéré ne fait pas partie de ce service." });
      }
      suggested = m.id;
    }

    // Nouveau fichier uploadé en priorité, sinon réutilisation d'un fichier existant (pièce jointe de salon).
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : reusedAttachment;

    // Lien de dépendance : le besoin doit pointer vers un ticket parent que l'émetteur peut voir.
    let parentId = null;
    if (parsed.data.parentId) {
      const parent = await prisma.ticket.findUnique({ where: { id: parsed.data.parentId } });
      if (parent && canSeeTicket(req.user, parent)) parentId = parent.id;
    }

    const reference = await nextReference();

    const ticket = await prisma.ticket.create({
      data: {
        reference,
        title,
        description,
        category: categoryLabel,
        type,
        urgency,
        status: "NEW",
        sourceSpace: space,
        sourceCompanyId: req.user.companyId, // entreprise de l'émetteur (badge)
        departmentId: department.id,
        submittedById: req.user.id,
        suggestedToId: suggested,
        attachmentUrl,
        parentId,
        leaveStart: leaveStart ? new Date(leaveStart) : null,
        leaveEnd: leaveEnd ? new Date(leaveEnd) : null,
        leaveKind: leaveKind || null,
      },
      include: ticketInclude,
    });

    notifyTicketCreated(ticket, ticket.submitter.email);

    // Notifications in-app : membres du service (hors émetteur/suggéré) + membre suggéré.
    const memberIds = await serviceMemberIds(department.id, [req.user.id, suggested]);
    await notify(memberIds, { type: "new_ticket", text: `Nouvelle demande « ${title} » dans ${department.name}`, ticketId: ticket.id });
    if (suggested && suggested !== req.user.id) {
      await notify([suggested], { type: "suggested", text: `Demande « ${title} » suggérée pour vous`, ticketId: ticket.id });
    }

    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "created", detail: { title } });

    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
});

/* ---------------- PATCH /api/tickets/:id/status ---------------- */
const statusSchema = z.object({ status: z.enum(STATUSES) });

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Statut invalide." });
    const { status } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: ticketInclude,
    });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    // Seul l'assigné (ou l'admin) change le statut.
    if (req.user.role !== "ADMIN" && ticket.assignedToId !== req.user.id) {
      return res.status(403).json({
        error: ticket.assignedToId
          ? "Ce ticket est pris en charge par un collègue."
          : "Prenez d'abord la demande en main pour en changer le statut.",
      });
    }
    if (ticket.status === "CLOSED") {
      return res.status(409).json({ error: "Ticket clôturé : créez un nouveau ticket pour rouvrir." });
    }
    if (status === ticket.status) return res.json({ ticket });

    const data = { status };
    if (status === "RESOLVED" && !ticket.resolvedAt) data.resolvedAt = new Date();

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data,
      include: ticketInclude,
    });

    if (status === "CLOSED") notifyTicketClosed(updated, updated.submitter.email);
    else notifyStatusChanged(updated, updated.submitter.email);

    if (updated.submittedById !== req.user.id) {
      await notify([updated.submittedById], { type: "status", text: `Votre demande « ${updated.title} » est passée à « ${STATUS_LABELS[status]} »`, ticketId: ticket.id });
    }

    // Besoin lié résolu/clôturé → prévenir le responsable du ticket parent qu'il est débloqué.
    if ((status === "RESOLVED" || status === "CLOSED") && ticket.parentId) {
      const parent = await prisma.ticket.findUnique({
        where: { id: ticket.parentId },
        select: { id: true, title: true, assignedToId: true, submittedById: true },
      });
      const recipient = parent && (parent.assignedToId || parent.submittedById);
      if (recipient && recipient !== req.user.id) {
        await notify([recipient], { type: "status", text: `Le besoin lié « ${updated.title} » est résolu — vous pouvez reprendre « ${parent.title} »`, ticketId: parent.id });
      }
    }

    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "status", detail: { from: ticket.status, to: status } });

    res.json({ ticket: updated });
  } catch (err) {
    next(err);
  }
});

/* ---------------- PATCH /api/tickets/:id/assign ---------------- */
const assignSchema = z.object({
  assignedToId: z.string().nullable().optional(),
  departmentId: z.string().optional(),
});

router.patch("/:id/assign", requireAuth, async (req, res, next) => {
  try {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètres d'assignation invalides." });

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { department: { select: { name: true } } },
    });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (!canActOnTicket(req.user, ticket)) {
      return res.status(403).json({ error: "Réservé aux membres du service destinataire." });
    }
    if (ticket.status === "CLOSED") {
      return res.status(409).json({ error: "Ticket clôturé : réassignation impossible." });
    }
    const oldDeptName = ticket.department?.name;

    const isAdmin = req.user.role === "ADMIN";
    const data = {};

    // Réassignation de service : admin uniquement.
    if (parsed.data.departmentId && parsed.data.departmentId !== ticket.departmentId) {
      if (!isAdmin) {
        return res.status(403).json({ error: "Seul un admin peut changer le service d'un ticket." });
      }
      const dep = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
      if (!dep) return res.status(400).json({ error: "Service cible introuvable." });
      data.departmentId = dep.id;
      data.assignedToId = null;
    }

    // Assignation. Un membre prend la main (s'assigne lui-même) ou relâche ;
    // l'admin peut assigner n'importe quel membre du service cible.
    if (parsed.data.assignedToId !== undefined) {
      if (!isAdmin) {
        // Pas de « vol » : on ne prend pas une demande déjà tenue par un collègue.
        if (ticket.assignedToId && ticket.assignedToId !== req.user.id) {
          return res.status(403).json({ error: "Déjà pris en charge par un collègue — demandez-lui un transfert." });
        }
        if (parsed.data.assignedToId && parsed.data.assignedToId !== req.user.id) {
          return res.status(403).json({ error: "Vous ne pouvez prendre la main que pour vous-même." });
        }
        data.assignedToId = parsed.data.assignedToId;
      } else {
        const targetDeptId = data.departmentId || ticket.departmentId;
        if (parsed.data.assignedToId) {
          const target = await prisma.user.findUnique({ where: { id: parsed.data.assignedToId } });
          if (!target || target.departmentId !== targetDeptId) {
            return res.status(400).json({ error: "Ce membre ne fait pas partie du service du ticket." });
          }
        }
        data.assignedToId = parsed.data.assignedToId;
      }
    }

    if (data.assignedToId && ticket.status === "NEW") data.status = "IN_PROGRESS";

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data,
      include: ticketInclude,
    });

    if (updated.assignedToId) {
      if (updated.submittedById !== req.user.id) {
        await notify([updated.submittedById], { type: "assigned", text: `${updated.assignee?.name} a pris en charge votre demande « ${updated.title} »`, ticketId: ticket.id });
      }
      if (updated.assignedToId !== req.user.id) {
        await notify([updated.assignedToId], { type: "assigned", text: `Une demande vous a été assignée : « ${updated.title} »`, ticketId: ticket.id });
      }
    }

    // Journal d'audit
    if (data.departmentId) {
      await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "reassigned", detail: { from: oldDeptName, to: updated.department?.name } });
    }
    if (parsed.data.assignedToId !== undefined) {
      if (updated.assignedToId) {
        await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "assigned", detail: { assignee: updated.assignee?.name, self: updated.assignedToId === req.user.id } });
      } else if (!data.departmentId) {
        await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "unassigned" });
      }
    }

    res.json({ ticket: updated });
  } catch (err) {
    next(err);
  }
});

/* ---------------- PATCH /api/tickets/:id/transfer — proposer/annuler un transfert ---------------- */
const transferSchema = z.object({ toUserId: z.string().nullable() });

router.patch("/:id/transfer", requireAuth, async (req, res, next) => {
  try {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètre de transfert invalide." });

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (ticket.status === "CLOSED") return res.status(409).json({ error: "Ticket clôturé." });

    const isAdmin = req.user.role === "ADMIN";
    // Seul l'assigné courant (ou l'admin) peut proposer/annuler un transfert.
    if (!isAdmin && ticket.assignedToId !== req.user.id) {
      return res.status(403).json({ error: "Seul l'assigné peut transférer ce ticket." });
    }

    // Annulation du transfert en attente.
    if (parsed.data.toUserId === null) {
      const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { transferToId: null }, include: ticketInclude });
      if (ticket.transferToId) await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "transfer_cancelled" });
      return res.json({ ticket: updated });
    }

    const target = await prisma.user.findUnique({ where: { id: parsed.data.toUserId } });
    if (!target || target.departmentId !== ticket.departmentId) {
      return res.status(400).json({ error: "Le collègue doit faire partie du même service." });
    }
    if (target.id === ticket.assignedToId) {
      return res.status(400).json({ error: "Ce ticket lui est déjà assigné." });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { transferToId: target.id },
      include: ticketInclude,
    });
    await notify([target.id], { type: "transfer_proposed", text: `${req.user.name} vous propose de reprendre « ${ticket.title} »`, ticketId: ticket.id });
    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "transfer_proposed", detail: { to: target.name } });
    res.json({ ticket: updated });
  } catch (err) {
    next(err);
  }
});

/* ---------------- PATCH /api/tickets/:id/transfer/respond — accepter/refuser ---------------- */
const respondSchema = z.object({ accept: z.boolean() });

router.patch("/:id/transfer/respond", requireAuth, async (req, res, next) => {
  try {
    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Réponse invalide." });

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (ticket.transferToId !== req.user.id) {
      return res.status(403).json({ error: "Aucun transfert à accepter pour vous sur ce ticket." });
    }

    const proposer = ticket.assignedToId; // l'assigné qui avait proposé le transfert
    const data = parsed.data.accept
      ? { assignedToId: req.user.id, transferToId: null, status: ticket.status === "NEW" ? "IN_PROGRESS" : ticket.status }
      : { transferToId: null };

    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data, include: ticketInclude });

    if (proposer && proposer !== req.user.id) {
      await notify([proposer], {
        type: parsed.data.accept ? "transfer_accepted" : "transfer_refused",
        text: `${req.user.name} a ${parsed.data.accept ? "accepté" : "refusé"} le transfert de « ${ticket.title} »`,
        ticketId: ticket.id,
      });
    }
    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: parsed.data.accept ? "transfer_accepted" : "transfer_refused" });

    res.json({ ticket: updated });
  } catch (err) {
    next(err);
  }
});

/* ---------------- POST /api/tickets/:id/comments ---------------- */
const commentSchema = z.object({
  content: z.string().min(1, "Commentaire vide."),
  isInternal: z.boolean().optional().default(false),
});

router.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (!canSeeTicket(req.user, ticket)) {
      return res.status(403).json({ error: "Accès refusé à ce ticket." });
    }

    const isInternal = parsed.data.isInternal && canActOnTicket(req.user, ticket);

    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: req.user.id,
        content: parsed.data.content,
        isInternal,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    // Notifie l'autre partie : le demandeur (si commentaire non interne) et l'assigné.
    const recips = [];
    if (!isInternal && ticket.submittedById !== req.user.id) recips.push(ticket.submittedById);
    if (ticket.assignedToId && ticket.assignedToId !== req.user.id) recips.push(ticket.assignedToId);
    await notify(recips, { type: "comment", text: `Nouveau commentaire sur « ${ticket.title} »`, ticketId: ticket.id });
    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "comment", detail: { internal: isInternal } });

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

/* ---------------- POST /api/tickets/:id/documents — joindre un document ---------------- */
router.post("/:id/documents", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (!canSeeTicket(req.user, ticket)) {
      return res.status(403).json({ error: "Accès refusé à ce ticket." });
    }
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });

    const document = await prisma.ticketDocument.create({
      data: {
        ticketId: ticket.id,
        url: `/uploads/${req.file.filename}`,
        name: req.file.originalname,
        uploadedById: req.user.id,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "document", detail: { name: req.file.originalname } });
    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
});

/* ---------------- POST /api/tickets/:id/feedback ---------------- */
const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
});

router.post("/:id/feedback", requireAuth, async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Note invalide (1 à 5)." });

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { feedback: true },
    });
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable." });
    if (ticket.submittedById !== req.user.id) {
      return res.status(403).json({ error: "Seul l'émetteur du ticket peut donner un avis." });
    }
    if (ticket.status !== "CLOSED" && ticket.status !== "RESOLVED") {
      return res.status(409).json({ error: "Feedback disponible après résolution/clôture." });
    }
    if (ticket.feedback) {
      return res.status(409).json({ error: "Un avis a déjà été déposé pour ce ticket." });
    }

    const feedback = await prisma.feedback.create({
      data: { ticketId: ticket.id, rating: parsed.data.rating, comment: parsed.data.comment || null },
    });
    await logEvent({ ticketId: ticket.id, actorId: req.user.id, action: "feedback", detail: { rating: parsed.data.rating } });
    res.status(201).json({ feedback });
  } catch (err) {
    next(err);
  }
});

export default router;
