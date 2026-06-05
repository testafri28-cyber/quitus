// Backoffice SaaS (éditeur Quitus) : clients (tenants), abonnements, facturation, revenus.
// Toutes les routes exigent le rôle SUPER_ADMIN. Aucun lien avec le frontoffice.
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireSuperAdmin, signSuperToken } from "../middleware/superadmin-auth.js";

const router = Router();

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

// À partir d'ici, tout exige un jeton backoffice valide (scope superadmin).
router.use(requireSuperAdmin);

router.get("/auth/me", (req, res) => res.json({ admin: req.superAdmin }));

const PLANS = ["STARTER", "ESSENTIEL", "PME", "ENTERPRISE"];
const STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CHURNED"];
const CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL"];
const INVOICE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
const METHODS = ["WAVE", "ORANGE_MONEY", "MTN_MOMO", "BANK_TRANSFER"];

const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

/* ---------------- Dashboard ---------------- */
router.get("/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);

    const [byStatus, mrrAgg, trialEndingSoon, recentPayments] = await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.payment.aggregate({ _sum: { amount_fcfa: true }, where: { paid_at: { gte: monthStart(now) } } }),
      prisma.tenant.findMany({
        where: { status: "TRIAL", trial_ends_at: { gte: now, lte: in7 } },
        orderBy: { trial_ends_at: "asc" },
      }),
      prisma.payment.findMany({
        take: 8,
        orderBy: { paid_at: "desc" },
        include: { tenant: { select: { id: true, name: true, plan: true } } },
      }),
    ]);

    const counts = { total: 0, TRIAL: 0, ACTIVE: 0, SUSPENDED: 0, CHURNED: 0 };
    for (const row of byStatus) { counts[row.status] = row._count._all; counts.total += row._count._all; }

    res.json({
      tenants: { total: counts.total, active: counts.ACTIVE, trial: counts.TRIAL, suspended: counts.SUSPENDED, churned: counts.CHURNED },
      mrr: mrrAgg._sum.amount_fcfa || 0,
      trialEndingSoon,
      recentPayments,
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
      },
    });
    res.status(201).json({ tenant });
  } catch (err) { next(err); }
});

router.get("/tenants/:id", async (req, res, next) => {
  try {
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

    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data });
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
    res.status(201).json({ invoice });
  } catch (err) { next(err); }
});

/* ---------------- Invoices ---------------- */
router.get("/invoices", async (req, res, next) => {
  try {
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
    res.json({ invoice: updated, payment });
  } catch (err) { next(err); }
});

/* ---------------- Revenue ---------------- */
router.get("/revenue", async (_req, res, next) => {
  try {
    const now = new Date();
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1); // début du 6e mois en arrière

    const [mrrAgg, paymentsByPlan, churnCount, recentPayments] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount_fcfa: true }, where: { paid_at: { gte: monthStart(now) } } }),
      prisma.payment.findMany({ select: { amount_fcfa: true, tenant: { select: { plan: true } } } }),
      prisma.tenant.count({ where: { status: "CHURNED" } }),
      prisma.payment.findMany({ where: { paid_at: { gte: sixAgo } }, select: { amount_fcfa: true, paid_at: true } }),
    ]);

    const mrr = mrrAgg._sum.amount_fcfa || 0;

    // Revenus cumulés par plan (d'après le plan courant du client).
    const byPlanMap = { STARTER: 0, ESSENTIEL: 0, PME: 0, ENTERPRISE: 0 };
    for (const p of paymentsByPlan) { const pl = p.tenant?.plan; if (pl && byPlanMap[pl] != null) byPlanMap[pl] += p.amount_fcfa; }
    const byPlan = PLANS.map((plan) => ({ plan, amount: byPlanMap[plan] }));

    // Paiements des 6 derniers mois (libellé YYYY-MM).
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

    res.json({ mrr, arr: mrr * 12, byPlan, churnThisMonth: churnCount, payments6months: series });
  } catch (err) { next(err); }
});

export default router;
