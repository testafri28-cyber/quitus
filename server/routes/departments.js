import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { CATEGORIES } from "../services/routing.js";

const router = Router();

// GET /api/departments — liste des services (avec entreprise rattachée)
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: [{ companyId: "asc" }, { name: "asc" }],
      include: {
        company: { select: { id: true, name: true, slug: true, color: true } },
        responsible: { select: { id: true, name: true } },
      },
    });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/companies — liste des entreprises
router.get("/companies", requireAuth, async (_req, res, next) => {
  try {
    const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    res.json({ companies });
  } catch (err) {
    next(err);
  }
});

// POST /api/departments/companies — créer une entreprise (admin)
const companySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug invalide (a-z, 0-9, -)."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide (ex. #378ADD)."),
});

router.post("/companies", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const company = await prisma.company.create({ data: parsed.data });
    res.status(201).json({ company });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ce slug d'entreprise existe déjà." });
    next(err);
  }
});

// PATCH /api/departments/:id — désigner le responsable / renommer (admin)
const updateDeptSchema = z.object({
  responsibleId: z.string().nullable().optional(),
  name: z.string().min(2).optional(),
});
router.patch("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = updateDeptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    if (parsed.data.responsibleId) {
      const u = await prisma.user.findUnique({ where: { id: parsed.data.responsibleId } });
      if (!u || u.departmentId !== req.params.id) {
        return res.status(400).json({ error: "Le responsable doit être un membre de ce service." });
      }
    }
    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { company: { select: { id: true, name: true, slug: true, color: true } }, responsible: { select: { id: true, name: true } } },
    });
    res.json({ department });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Service introuvable." });
    next(err);
  }
});

// DELETE /api/departments/companies/:id — supprimer une entreprise (admin)
router.delete("/companies/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    await prisma.company.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Entreprise introuvable." });
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Entreprise utilisée (membres, tickets ou services rattachés) : réaffectez-les avant de supprimer." });
    }
    next(err);
  }
});

// DELETE /api/departments/:id — supprimer un service (admin)
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Service introuvable." });
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Service utilisé (tickets ou membres rattachés) : réaffectez-les avant de supprimer." });
    }
    next(err);
  }
});

// GET /api/departments/:id/members — membres d'un service (pour suggestion / transfert)
router.get("/:id/members", requireAuth, async (req, res, next) => {
  try {
    const members = await prisma.user.findMany({
      where: { departmentId: req.params.id, role: "MEMBER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

// Charge un service + vérifie que l'appelant peut gérer son équipe (admin ou responsable).
async function loadManageableDept(req, res) {
  const dep = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!dep) { res.status(404).json({ error: "Service introuvable." }); return null; }
  if (req.user.role !== "ADMIN" && dep.responsibleId !== req.user.id) {
    res.status(403).json({ error: "Réservé au responsable du service." });
    return null;
  }
  return dep;
}

// GET /api/departments/:id/candidates — membres ajoutables (non rattachés, même entreprise si le service en a une)
router.get("/:id/candidates", requireAuth, async (req, res, next) => {
  try {
    const dep = await loadManageableDept(req, res);
    if (!dep) return;
    const where = { role: "MEMBER", NOT: { departmentId: dep.id } };
    if (dep.companyId) where.companyId = dep.companyId; // service d'entreprise → on reste dans l'entreprise
    const candidates = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, department: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ candidates });
  } catch (err) {
    next(err);
  }
});

// POST /api/departments/:id/members { userId } — rattacher un membre au service (admin ou responsable)
const addMemberSchema = z.object({ userId: z.string() });
router.post("/:id/members", requireAuth, async (req, res, next) => {
  try {
    const dep = await loadManageableDept(req, res);
    if (!dep) return;
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Paramètres invalides." });
    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!target) return res.status(404).json({ error: "Utilisateur introuvable." });
    if (target.role !== "MEMBER") return res.status(400).json({ error: "Seul un membre peut rejoindre un service." });
    if (dep.companyId && target.companyId !== dep.companyId) {
      return res.status(400).json({ error: "Ce membre appartient à une autre entreprise." });
    }
    const member = await prisma.user.update({
      where: { id: target.id },
      data: { departmentId: dep.id },
      select: { id: true, name: true, email: true },
    });
    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/departments/:id/members/:userId — retirer un membre du service (admin ou responsable)
router.delete("/:id/members/:userId", requireAuth, async (req, res, next) => {
  try {
    const dep = await loadManageableDept(req, res);
    if (!dep) return;
    const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!target || target.departmentId !== dep.id) {
      return res.status(404).json({ error: "Ce membre n'appartient pas à ce service." });
    }
    await prisma.user.update({ where: { id: target.id }, data: { departmentId: null } });
    // S'il était responsable du service, on libère la responsabilité.
    if (dep.responsibleId === target.id) {
      await prisma.department.update({ where: { id: dep.id }, data: { responsibleId: null } });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/categories — catégories du formulaire (label → service + company)
router.get("/categories", requireAuth, (_req, res) => {
  res.json({ categories: CATEGORIES });
});

// GET /api/departments/stats — KPIs admin (vue globale WCA + IDC)
router.get("/stats", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const [departments, companies] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.company.findMany({ orderBy: { name: "asc" } }),
    ]);

    const byDeptStatus = await prisma.ticket.groupBy({
      by: ["departmentId", "status"],
      _count: { _all: true },
    });
    const byCompany = await prisma.ticket.groupBy({
      by: ["sourceCompanyId"],
      _count: { _all: true },
    });
    const byType = await prisma.ticket.groupBy({
      by: ["type"],
      _count: { _all: true },
    });
    const resolved = await prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, departmentId: true },
    });
    const feedbacks = await prisma.feedback.findMany({ select: { rating: true } });
    const total = await prisma.ticket.count();

    const perDepartment = departments.map((dep) => {
      const rows = byDeptStatus.filter((r) => r.departmentId === dep.id);
      const counts = Object.fromEntries(rows.map((s) => [s.status, s._count._all]));
      const depResolved = resolved.filter((r) => r.departmentId === dep.id);
      const avgMs =
        depResolved.length > 0
          ? depResolved.reduce((sum, t) => sum + (t.resolvedAt.getTime() - t.createdAt.getTime()), 0) /
            depResolved.length
          : null;
      return {
        id: dep.id,
        name: dep.name,
        code: dep.code,
        companyId: dep.companyId,
        total: rows.reduce((s, r) => s + r._count._all, 0),
        counts,
        avgResolutionHours: avgMs != null ? +(avgMs / 36e5).toFixed(1) : null,
      };
    });

    const perCompany = companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      color: c.color,
      total: byCompany.find((r) => r.sourceCompanyId === c.id)?._count._all || 0,
    }));

    const avgRating =
      feedbacks.length > 0
        ? +(feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(2)
        : null;

    const perType = {
      INTERVENTION: byType.find((r) => r.type === "INTERVENTION")?._count._all || 0,
      NEED: byType.find((r) => r.type === "NEED")?._count._all || 0,
    };

    res.json({ total, avgRating, feedbackCount: feedbacks.length, perDepartment, perCompany, perType });
  } catch (err) {
    next(err);
  }
});

// POST /api/departments — création d'un service (admin)
const createSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).regex(/^[a-z0-9-]+$/, "Code invalide (a-z, 0-9, -)."),
  companyId: z.string().nullable().optional(),
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const department = await prisma.department.create({
      data: { name: parsed.data.name, code: parsed.data.code, companyId: parsed.data.companyId || null },
    });
    res.status(201).json({ department });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ce code existe déjà." });
    next(err);
  }
});

export default router;
