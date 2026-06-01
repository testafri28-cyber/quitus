import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

const ACTIONS = [
  "created", "status", "assigned", "unassigned", "reassigned",
  "transfer_proposed", "transfer_accepted", "transfer_refused", "transfer_cancelled",
  "comment", "document", "feedback",
];

function buildWhere(q) {
  const where = {};
  if (q.action && ACTIONS.includes(q.action)) where.action = q.action;
  if (q.actorId) where.actorId = q.actorId;
  if (q.ticketId) where.ticketId = q.ticketId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }
  return where;
}

const includeRefs = {
  actor: { select: { id: true, name: true } },
  ticket: { select: { id: true, reference: true, title: true } },
};

// GET /api/audit — journal global (admin), filtrable + paginé
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 40));
    const where = buildWhere(req.query);

    const [total, events] = await Promise.all([
      prisma.ticketEvent.count({ where }),
      prisma.ticketEvent.findMany({
        where,
        include: includeRefs,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ events, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

// GET /api/audit/export — export CSV du journal filtré (admin)
router.get("/export", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const where = buildWhere(req.query);
    const events = await prisma.ticketEvent.findMany({
      where,
      include: includeRefs,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Date", "Action", "Acteur", "Ticket", "Titre", "Détail"].map(esc).join(",")];
    for (const e of events) {
      lines.push([
        new Date(e.createdAt).toISOString(),
        e.action,
        e.actor?.name || "—",
        e.ticket?.reference || "—",
        e.ticket?.title || "",
        e.detail || "",
      ].map(esc).join(","));
    }
    const csv = "﻿" + lines.join("\r\n"); // BOM pour Excel/UTF-8

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="audit.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
