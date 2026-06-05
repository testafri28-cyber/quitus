// Backoffice SaaS (éditeur Quitus) : clients (tenants), abonnements, facturation, revenus.
// Toutes les routes exigent le rôle SUPER_ADMIN. Aucun lien avec le frontoffice.
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireSuperAdmin, signSuperToken } from "../middleware/superadmin-auth.js";
import { computeHealth } from "../services/healthScore.js";
import { socketConnectionCount } from "../socket.js";
import { pushEnabled } from "../services/push.js";
import { UPLOAD_DIR } from "../lib/uploads.js";

const router = Router();

// État technique du système (observabilité — partagé par /cockpit et /system/health).
function systemHealthPayload() {
  let storage = { mode: process.env.S3_BUCKET ? "objet (S3/R2)" : "disque local", files: 0, bytes: 0 };
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    storage.files = files.length;
    for (const f of files) { try { storage.bytes += fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch { /* ignore */ } }
  } catch { /* dossier absent */ }
  return {
    uptimeSeconds: Math.round(process.uptime()),
    socketConnections: socketConnectionCount(),
    email: { state: process.env.RESEND_API_KEY ? "actif" : "disabled" },
    webPush: { state: pushEnabled ? "actif" : "disabled" },
    storage,
    jobs: { state: "disabled", pending: 0 }, // pas de file de jobs dans ce build
  };
}

/* ---------------- Authentification du backoffice (login séparé) ---------------- */
const loginSchema = z.object({
  email: z.string().email("E-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});
router.post("/auth/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const admin = await prisma.superAdmin.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });
    if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }
    const token = signSuperToken(admin);
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) { next(err); }
});

// Fin d'une session de connexion-en-tant-que : accepte le JETON D'IMPERSONATION
// (scope "impersonation"), PAS le jeton backoffice → placé AVANT la garde superadmin.
router.post("/impersonate/stop", async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = (header.startsWith("Bearer ") ? header.slice(7) : null) || req.body?.token;
    if (!token) return res.status(400).json({ error: "Jeton requis." });
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: "Jeton invalide." }); }
    if (payload.scope !== "impersonation") return res.status(400).json({ error: "Ce n'est pas une session de consultation." });
    await prisma.superAdminAudit.create({
      data: {
        admin_id: payload.impersonatedBy || "?", admin_email: payload.impersonatedByEmail || "?",
        action: "IMPERSONATION_END", detail: `Fin de consultation${payload.tenantName ? ` de « ${payload.tenantName} »` : ""}`,
        tenant_id: payload.tenantId || null, target_user_id: payload.sub || null, ip: req.ip,
      },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// À partir d'ici, tout exige un jeton backoffice valide (scope superadmin).
router.use(requireSuperAdmin);

router.get("/auth/me", (req, res) => res.json({ admin: req.superAdmin }));

const PLANS = ["STARTER", "ESSENTIEL", "PME", "ENTERPRISE"];
const STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CHURNED"];
const CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL"];
const INVOICE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
const METHODS = ["WAVE", "ORANGE_MONEY", "MTN_MOMO", "BANK_TRANSFER"];

const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

// Journal d'audit (append-only) — qui a fait quoi dans le backoffice.
async function logAudit(req, action, detail) {
  try {
    await prisma.superAdminAudit.create({
      data: { admin_id: req.superAdmin.id, admin_email: req.superAdmin.email, action, detail: detail || null },
    });
  } catch (e) { /* l'audit ne doit jamais bloquer l'action */ }
}

// Bascule paresseuse : les factures en attente dont l'échéance est dépassée passent OVERDUE.
async function markOverdue() {
  await prisma.invoice.updateMany({
    where: { status: "PENDING", due_date: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}

// Carte des prix mensuels par plan (FCFA), depuis la base.
async function planPriceMap() {
  const rows = await prisma.planPrice.findMany();
  const map = {};
  for (const r of rows) map[r.plan] = r.monthly_fcfa;
  return map;
}

// MRR = somme des prix mensuels des abonnements ACTIFS (vrai revenu récurrent).
async function computeMrr(priceMap) {
  const actives = await prisma.tenant.groupBy({ by: ["plan"], where: { status: "ACTIVE" }, _count: { _all: true } });
  let mrr = 0;
  const byPlan = {};
  for (const row of actives) {
    const price = priceMap[row.plan] || 0;
    const amount = price * row._count._all;
    mrr += amount;
    byPlan[row.plan] = amount;
  }
  return { mrr, byPlan };
}

const HEALTH_TTL_MS = 60 * 60 * 1000; // recalcule à la lecture si le dernier snapshot a > 1 h
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999);

// Statut de facturation d'un tenant, dérivé des factures réelles.
async function billingStatusFor(tenant) {
  if (tenant.status === "SUSPENDED") return "suspended";
  const overdue = await prisma.invoice.count({ where: { tenant_id: tenant.id, status: "OVERDUE" } });
  if (overdue > 0) return "overdue";
  const pending = await prisma.invoice.count({ where: { tenant_id: tenant.id, status: "PENDING" } });
  if (pending > 0) return "pending";
  return "up_to_date";
}

// Dernier snapshot de santé ; recalculé (et persisté) s'il est absent ou périmé (> 1 h).
async function freshSnapshot(tenant) {
  const last = await prisma.healthSnapshot.findFirst({ where: { tenant_id: tenant.id }, orderBy: { computed_at: "desc" } });
  if (last && Date.now() - new Date(last.computed_at).getTime() < HEALTH_TTL_MS) return last;
  const billingStatus = await billingStatusFor(tenant);
  const h = computeHealth({
    tickets30d: tenant.tickets_30d, tickets90dAvg: tenant.tickets_90d_avg,
    daysSinceLastActivity: daysSince(tenant.last_activity_at),
    openEscalations: tenant.open_escalations, escalationsOver24h: tenant.escalations_over_24h,
    billingStatus,
  });
  return prisma.healthSnapshot.create({ data: { tenant_id: tenant.id, ...h } });
}

/* ---------------- Dashboard ---------------- */
router.get("/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    await markOverdue();
    const priceMap = await planPriceMap();

    const [byStatus, collectedAgg, trialEndingSoon, recentPayments, recentAudit] = await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.payment.aggregate({ _sum: { amount_fcfa: true }, where: { paid_at: { gte: monthStart(now) } } }),
      prisma.tenant.findMany({
        where: { status: "TRIAL", trial_ends_at: { gte: now, lte: in7 } },
        orderBy: { trial_ends_at: "asc" },
      }),
      prisma.payment.findMany({
        take: 6,
        orderBy: { paid_at: "desc" },
        include: { tenant: { select: { id: true, name: true, plan: true } } },
      }),
      prisma.superAdminAudit.findMany({ take: 6, orderBy: { created_at: "desc" } }),
    ]);

    const counts = { total: 0, TRIAL: 0, ACTIVE: 0, SUSPENDED: 0, CHURNED: 0 };
    for (const row of byStatus) { counts[row.status] = row._count._all; counts.total += row._count._all; }
    const { mrr } = await computeMrr(priceMap);

    res.json({
      tenants: { total: counts.total, active: counts.ACTIVE, trial: counts.TRIAL, suspended: counts.SUSPENDED, churned: counts.CHURNED },
      mrr,                                                  // revenu récurrent (abonnements actifs)
      collectedThisMonth: collectedAgg._sum.amount_fcfa || 0, // réellement encaissé ce mois
      trialEndingSoon,
      recentPayments,
      recentAudit,
    });
  } catch (err) { next(err); }
});

/* ---------------- Tenants ---------------- */
router.get("/tenants", async (req, res, next) => {
  try {
    const { status, plan } = req.query;
    const where = {};
    if (status && STATUSES.includes(status)) where.status = status;
    if (plan && PLANS.includes(plan)) where.plan = plan;
    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: { _count: { select: { invoices: true, payments: true } } },
    });
    res.json({ tenants });
  } catch (err) { next(err); }
});

const tenantCreateSchema = z.object({
  name: z.string().trim().min(2, "Nom du client requis."),
  contact_email: z.string().email("E-mail de contact invalide."),
  contact_phone: z.string().trim().optional(),
  plan: z.enum(PLANS).default("STARTER"),
  status: z.enum(STATUSES).default("TRIAL"),
  billing_cycle: z.enum(CYCLES).default("MONTHLY"),
  trial_ends_at: z.string().datetime().optional(),
  next_renewal: z.string().datetime().optional(),
});

router.post("/tenants", async (req, res, next) => {
  try {
    const parsed = tenantCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const d = parsed.data;
    const tenant = await prisma.tenant.create({
      data: {
        name: d.name,
        contact_email: d.contact_email,
        contact_phone: d.contact_phone || null,
        plan: d.plan,
        status: d.status,
        billing_cycle: d.billing_cycle,
        trial_ends_at: d.trial_ends_at ? new Date(d.trial_ends_at) : (d.status === "TRIAL" ? new Date(Date.now() + 14 * 86400000) : null),
        next_renewal: d.next_renewal ? new Date(d.next_renewal) : null,
        churned_at: d.status === "CHURNED" ? new Date() : null,
      },
    });
    await logAudit(req, "tenant.create", `Client « ${tenant.name} » créé (${tenant.plan}/${tenant.status})`);
    res.status(201).json({ tenant });
  } catch (err) { next(err); }
});

router.get("/tenants/:id", async (req, res, next) => {
  try {
    await markOverdue();
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        invoices: { orderBy: { created_at: "desc" } },
        payments: { orderBy: { paid_at: "desc" } },
      },
    });
    if (!tenant) return res.status(404).json({ error: "Client introuvable." });
    res.json({ tenant });
  } catch (err) { next(err); }
});

const tenantUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().trim().nullable().optional(),
  plan: z.enum(PLANS).optional(),
  status: z.enum(STATUSES).optional(),
  billing_cycle: z.enum(CYCLES).optional(),
  next_renewal: z.string().datetime().nullable().optional(),
});

router.patch("/tenants/:id", async (req, res, next) => {
  try {
    const parsed = tenantUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const d = parsed.data;
    const data = {};
    for (const k of ["name", "contact_email", "contact_phone", "plan", "status", "billing_cycle"]) {
      if (d[k] !== undefined) data[k] = d[k];
    }
    if (d.next_renewal !== undefined) data.next_renewal = d.next_renewal ? new Date(d.next_renewal) : null;
    // Sortie de trial : on efface l'échéance d'essai.
    if (d.status && d.status !== "TRIAL") data.trial_ends_at = null;
    // Suivi du churn : on horodate le passage à CHURNED (et on l'efface si réactivation).
    if (d.status === "CHURNED") data.churned_at = new Date();
    else if (d.status && d.status !== "CHURNED") data.churned_at = null;

    const before = await prisma.tenant.findUnique({ where: { id: req.params.id }, select: { plan: true, status: true } });
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data });

    // Audit lisible des changements significatifs.
    const changes = [];
    if (d.plan && before && d.plan !== before.plan) changes.push(`plan ${before.plan}→${d.plan}`);
    if (d.status && before && d.status !== before.status) changes.push(`statut ${before.status}→${d.status}`);
    if (d.name || d.contact_email || d.contact_phone !== undefined) changes.push("coordonnées");
    if (changes.length) await logAudit(req, "tenant.update", `« ${tenant.name} » : ${changes.join(", ")}`);

    res.json({ tenant });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Client introuvable." });
    next(err);
  }
});

const invoiceCreateSchema = z.object({
  amount_fcfa: z.number().int().positive("Montant invalide."),
  due_date: z.string().datetime("Date d'échéance invalide."),
  notes: z.string().trim().optional(),
});

router.post("/tenants/:id/invoices", async (req, res, next) => {
  try {
    const parsed = invoiceCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "Client introuvable." });
    const invoice = await prisma.invoice.create({
      data: {
        tenant_id: tenant.id,
        amount_fcfa: parsed.data.amount_fcfa,
        due_date: new Date(parsed.data.due_date),
        notes: parsed.data.notes || null,
      },
    });
    await logAudit(req, "invoice.create", `Facture ${invoice.amount_fcfa} FCFA pour « ${tenant.name} »`);
    res.status(201).json({ invoice });
  } catch (err) { next(err); }
});

/* ---------------- Invoices ---------------- */
router.get("/invoices", async (req, res, next) => {
  try {
    await markOverdue();
    const { status } = req.query;
    const where = {};
    if (status && INVOICE_STATUSES.includes(status)) where.status = status;
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { due_date: "desc" },
      include: { tenant: { select: { id: true, name: true, plan: true } } },
    });
    res.json({ invoices });
  } catch (err) { next(err); }
});

const paySchema = z.object({
  method: z.enum(METHODS),
  transaction_ref: z.string().trim().optional(),
});

router.patch("/invoices/:id/pay", async (req, res, next) => {
  try {
    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Facture introuvable." });
    if (invoice.status === "PAID") return res.status(409).json({ error: "Facture déjà payée." });

    // Marquer payée + enregistrer le paiement, de façon atomique.
    const [updated, payment] = await prisma.$transaction([
      prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paid_at: new Date() } }),
      prisma.payment.create({
        data: {
          tenant_id: invoice.tenant_id,
          amount_fcfa: invoice.amount_fcfa,
          method: parsed.data.method,
          transaction_ref: parsed.data.transaction_ref || null,
        },
      }),
    ]);
    await logAudit(req, "invoice.pay", `Facture ${invoice.amount_fcfa} FCFA encaissée (${parsed.data.method})`);
    res.json({ invoice: updated, payment });
  } catch (err) { next(err); }
});

// Annuler une facture (uniquement si non payée).
router.patch("/invoices/:id/cancel", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Facture introuvable." });
    if (invoice.status === "PAID") return res.status(409).json({ error: "Une facture payée ne peut être annulée." });
    if (invoice.status === "CANCELLED") return res.json({ invoice });
    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
    await logAudit(req, "invoice.cancel", `Facture ${invoice.amount_fcfa} FCFA annulée`);
    res.json({ invoice: updated });
  } catch (err) { next(err); }
});

/* ---------------- Compte éditeur : changer son mot de passe ---------------- */
const pwdSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit faire au moins 8 caractères."),
});
router.patch("/auth/password", async (req, res, next) => {
  try {
    const parsed = pwdSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const admin = await prisma.superAdmin.findUnique({ where: { id: req.superAdmin.id } });
    if (!admin || !(await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash))) {
      return res.status(400).json({ error: "Mot de passe actuel incorrect." });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.superAdmin.update({ where: { id: admin.id }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ---------------- Catalogue tarifaire + journal d'audit ---------------- */
router.get("/plans", async (_req, res, next) => {
  try {
    const rows = await prisma.planPrice.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.plan, r.monthly_fcfa]));
    res.json({ plans: PLANS.map((plan) => ({ plan, monthly_fcfa: map[plan] || 0 })) });
  } catch (err) { next(err); }
});

router.get("/audit", async (_req, res, next) => {
  try {
    const entries = await prisma.superAdminAudit.findMany({ take: 50, orderBy: { created_at: "desc" } });
    res.json({ entries });
  } catch (err) { next(err); }
});

/* ---------------- Revenue ---------------- */
router.get("/revenue", async (_req, res, next) => {
  try {
    const now = new Date();
    const mStart = monthStart(now);
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1); // début du 6e mois en arrière

    const priceMap = await planPriceMap();
    const { mrr, byPlan: mrrByPlan } = await computeMrr(priceMap);

    const [collectedAgg, churnedThisMonth, activeCount, recentPayments] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount_fcfa: true }, where: { paid_at: { gte: mStart } } }),
      prisma.tenant.count({ where: { status: "CHURNED", churned_at: { gte: mStart } } }),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.payment.findMany({ where: { paid_at: { gte: sixAgo } }, select: { amount_fcfa: true, paid_at: true } }),
    ]);

    // MRR récurrent par plan (abonnements actifs × prix).
    const byPlan = PLANS.map((plan) => ({ plan, amount: mrrByPlan[plan] || 0 }));

    // Taux de churn du mois : partis ce mois / (actifs + partis ce mois).
    const churnBase = activeCount + churnedThisMonth;
    const churnRate = churnBase > 0 ? Math.round((churnedThisMonth / churnBase) * 1000) / 10 : 0;

    // Paiements encaissés sur 6 mois (libellé YYYY-MM).
    const series = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      series.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, label: m.toLocaleDateString("fr-FR", { month: "short" }), total: 0 });
    }
    const idx = Object.fromEntries(series.map((s, i) => [s.key, i]));
    for (const p of recentPayments) {
      const d = new Date(p.paid_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (idx[key] != null) series[idx[key]].total += p.amount_fcfa;
    }

    res.json({
      mrr,
      arr: mrr * 12,
      collectedThisMonth: collectedAgg._sum.amount_fcfa || 0,
      byPlan,
      churnThisMonth: churnedThisMonth,
      churnRate,
      payments6months: series,
    });
  } catch (err) { next(err); }
});

/* ---------------- Santé système ---------------- */
router.get("/system/health", (_req, res) => res.json(systemHealthPayload()));

/* ---------------- Cockpit (landing orientée action) ---------------- */
const SEV_ORDER = { high: 0, medium: 1, low: 2 };

router.get("/cockpit", async (_req, res, next) => {
  try {
    await markOverdue();
    const now = new Date();
    const mStart = monthStart(now);
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const priceMap = await planPriceMap();

    const [{ mrr }, overdueAgg, tenants, churnedTotal, activeCount] = await Promise.all([
      computeMrr(priceMap),
      prisma.invoice.aggregate({ _sum: { amount_fcfa: true }, _count: { _all: true }, where: { status: "OVERDUE" } }),
      prisma.tenant.findMany(),
      prisma.tenant.count({ where: { status: "CHURNED" } }),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
    ]);

    // Santé de chaque compte (recalcul paresseux).
    const withHealth = [];
    for (const t of tenants) {
      const snap = await freshSnapshot(t);
      withHealth.push({ tenant: t, snap });
    }
    const atRisk = withHealth.filter((x) => x.snap.bucket === "A_RISQUE");

    // File d'attention (uniquement des items actionnables).
    const queue = [];
    const overdueInvoices = await prisma.invoice.findMany({
      where: { status: "OVERDUE" }, include: { tenant: { select: { id: true, name: true } } }, orderBy: { due_date: "asc" }, take: 10,
    });
    for (const inv of overdueInvoices) {
      queue.push({ type: "billing", severity: "high", label: `Facture en retard — ${inv.tenant?.name}`, detail: `${inv.amount_fcfa.toLocaleString("fr-FR")} FCFA`, action: "open_account", targetId: inv.tenant?.id });
    }
    for (const x of withHealth) {
      if (x.tenant.status === "TRIAL" && x.tenant.trial_ends_at && x.tenant.trial_ends_at >= now && x.tenant.trial_ends_at <= in7) {
        const d = Math.max(0, Math.ceil((new Date(x.tenant.trial_ends_at) - now) / 86400000));
        queue.push({ type: "trial", severity: "medium", label: `Fin d'essai — ${x.tenant.name}`, detail: `J-${d}`, action: "open_account", targetId: x.tenant.id });
      }
    }
    for (const x of atRisk) {
      queue.push({ type: "health", severity: "high", label: `Compte à risque — ${x.tenant.name}`, detail: `Score ${x.snap.score}/100`, action: "open_account", targetId: x.tenant.id });
    }
    for (const x of withHealth) {
      if (x.tenant.open_escalations > 0) {
        queue.push({ type: "support", severity: x.tenant.escalations_over_24h > 0 ? "high" : "medium", label: `Escalade ouverte — ${x.tenant.name}`, detail: `${x.tenant.open_escalations} escalade(s)`, action: "open_account", targetId: x.tenant.id });
      }
    }
    queue.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

    const watchlist = withHealth
      .slice().sort((a, b) => a.snap.score - b.snap.score).slice(0, 5)
      .map((x) => ({ id: x.tenant.id, name: x.tenant.name, plan: x.tenant.plan, status: x.tenant.status, score: x.snap.score, bucket: x.snap.bucket }));

    const netRetention = Math.round((activeCount / Math.max(1, activeCount + churnedTotal)) * 100);

    res.json({
      kpis: {
        mrr,
        netRetention,                                   // rétention logos (%)
        atRiskCount: atRisk.length,
        overdueTotal: overdueAgg._sum.amount_fcfa || 0, // FCFA en retard
        overdueCount: overdueAgg._count._all,
      },
      attentionQueue: queue,
      systemHealth: systemHealthPayload(),
      watchlist,
    });
  } catch (err) { next(err); }
});

/* ---------------- Comptes (clients) + fiche 360° ---------------- */
const BUCKETS = ["SAIN", "A_SURVEILLER", "A_RISQUE"];

router.get("/accounts", async (req, res, next) => {
  try {
    await markOverdue();
    const { status, plan, bucket } = req.query;
    const where = {};
    if (status && STATUSES.includes(status)) where.status = status;
    if (plan && PLANS.includes(plan)) where.plan = plan;
    const tenants = await prisma.tenant.findMany({
      where, orderBy: { created_at: "desc" },
      include: { _count: { select: { invoices: true } } },
    });
    let accounts = [];
    for (const t of tenants) {
      const snap = await freshSnapshot(t);
      accounts.push({
        id: t.id, name: t.name, plan: t.plan, status: t.status,
        contact_email: t.contact_email, created_at: t.created_at, next_renewal: t.next_renewal, trial_ends_at: t.trial_ends_at,
        invoiceCount: t._count.invoices,
        health: { score: snap.score, bucket: snap.bucket },
      });
    }
    if (bucket && BUCKETS.includes(bucket)) accounts = accounts.filter((a) => a.health.bucket === bucket);
    res.json({ accounts });
  } catch (err) { next(err); }
});

router.get("/accounts/:id", async (req, res, next) => {
  try {
    await markOverdue();
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        invoices: { orderBy: { created_at: "desc" } },
        payments: { orderBy: { paid_at: "desc" } },
      },
    });
    if (!tenant) return res.status(404).json({ error: "Compte introuvable." });

    const snap = await freshSnapshot(tenant);
    const billingStatus = await billingStatusFor(tenant);
    const trend = await prisma.healthSnapshot.findMany({ where: { tenant_id: tenant.id }, orderBy: { computed_at: "desc" }, take: 12, select: { score: true, computed_at: true } });

    // Timeline d'activité du compte (depuis l'audit).
    const timeline = await prisma.superAdminAudit.findMany({ where: { tenant_id: tenant.id }, orderBy: { created_at: "desc" }, take: 15 });

    // Cible d'impersonation (si reliée).
    let impersonation = { available: false };
    if (tenant.frontoffice_user_id) {
      const u = await prisma.user.findUnique({ where: { id: tenant.frontoffice_user_id }, select: { id: true, name: true, email: true } });
      if (u) impersonation = { available: true, user: u };
    }

    res.json({
      tenant,
      health: { ...snap, billingStatus, trend: trend.reverse() },
      usage: {
        tickets30d: tenant.tickets_30d, tickets90dAvg: tenant.tickets_90d_avg,
        lastActivityAt: tenant.last_activity_at,
        openEscalations: tenant.open_escalations, escalationsOver24h: tenant.escalations_over_24h,
      },
      timeline,
      impersonation,
    });
  } catch (err) { next(err); }
});

/* ---------------- Connexion-en-tant-que (impersonation) ---------------- */
router.post("/accounts/:id/impersonate", async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "Compte introuvable." });
    if (!tenant.frontoffice_user_id) return res.status(409).json({ error: "Ce compte n'est pas relié à un utilisateur frontoffice." });
    const user = await prisma.user.findUnique({ where: { id: tenant.frontoffice_user_id } });
    if (!user) return res.status(409).json({ error: "Utilisateur frontoffice introuvable." });

    // JWT frontoffice JETABLE (sub réel → session valide ; scope impersonation → 0 accès backoffice).
    const token = jwt.sign(
      {
        sub: user.id, role: user.role, scope: "impersonation",
        impersonatedBy: req.superAdmin.id, impersonatedByEmail: req.superAdmin.email,
        tenantId: tenant.id, tenantName: tenant.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30m" }
    );
    await prisma.superAdminAudit.create({
      data: {
        admin_id: req.superAdmin.id, admin_email: req.superAdmin.email,
        action: "IMPERSONATION_START", detail: `Consultation de « ${tenant.name} » en tant que ${user.email}`,
        tenant_id: tenant.id, target_user_id: user.id, ip: req.ip,
      },
    });
    res.json({ token, user: { name: user.name, email: user.email }, tenant: { id: tenant.id, name: tenant.name } });
  } catch (err) { next(err); }
});

export default router;
