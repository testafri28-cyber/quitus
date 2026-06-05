// Seed séparé pour tester le backoffice SaaS (éditeur Quitus).
// Crée 1 compte éditeur (table SuperAdmin, indépendante du frontoffice) + 3 tenants
// de démo avec factures et paiements.
// Lancer : npm run seed:superadmin   (ou : node prisma/seed-superadmin.js)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeHealth } from "../services/healthScore.js";

const prisma = new PrismaClient();

const SUPER_EMAIL = "admin@quitus.ci";
const SUPER_PASSWORD = "superadmin123";

// Tarifs indicatifs (FCFA / mois) par plan.
const PLAN_PRICE = { STARTER: 25000, ESSENTIEL: 50000, PME: 150000, ENTERPRISE: 500000 };

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);
const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n, 15); return d; };

async function main() {
  // 1) Compte éditeur (backoffice) — table SuperAdmin dédiée, AUCUN lien avec User/Company.
  const passwordHash = await bcrypt.hash(SUPER_PASSWORD, 10);
  const admin = await prisma.superAdmin.upsert({
    where: { email: SUPER_EMAIL },
    update: { passwordHash, name: "Super Admin Quitus" },
    create: { name: "Super Admin Quitus", email: SUPER_EMAIL, passwordHash },
  });
  console.log(`• Compte éditeur (SuperAdmin) : ${admin.email} / ${SUPER_PASSWORD}`);

  // 2) Catalogue tarifaire des plans (prix mensuel FCFA) — base du calcul MRR/ARR.
  for (const [plan, price] of Object.entries(PLAN_PRICE)) {
    await prisma.planPrice.upsert({ where: { plan }, update: { monthly_fcfa: price }, create: { plan, monthly_fcfa: price } });
  }

  // 3) Réinitialise les données de démo du backoffice (idempotent)
  await prisma.healthSnapshot.deleteMany({});
  await prisma.superAdminAudit.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.tenant.deleteMany({});

  // Lien d'impersonation : on relie 1 tenant de démo à un vrai utilisateur frontoffice
  // (s'il existe) pour démontrer la « connexion-en-tant-que ». Sémantiquement fictif (démo).
  const foUser = await prisma.user.findFirst({ where: { email: "yapo.arthur@idc.ci" } });

  // 3) Tenants de démo (entreprises qui PAIENT pour Quitus) + signaux de santé.
  const abc = await prisma.tenant.create({
    data: {
      name: "Groupe ABC", plan: "PME", status: "ACTIVE", billing_cycle: "MONTHLY",
      contact_email: "dsi@groupe-abc.ci", contact_phone: "+225 07 00 00 00 01",
      next_renewal: daysFromNow(20),
      last_activity_at: daysFromNow(0), tickets_30d: 42, tickets_90d_avg: 38,
      open_escalations: 0, escalations_over_24h: 0,
      frontoffice_user_id: foUser ? foUser.id : null,
    },
  });
  const beta = await prisma.tenant.create({
    data: {
      name: "Beta Corp", plan: "ESSENTIEL", status: "TRIAL", billing_cycle: "MONTHLY",
      contact_email: "it@beta-corp.ci", contact_phone: "+225 07 00 00 00 02",
      trial_ends_at: daysFromNow(5),
      last_activity_at: daysFromNow(-10), tickets_30d: 9, tickets_90d_avg: 20,
      open_escalations: 1, escalations_over_24h: 0,
    },
  });
  const ancien = await prisma.tenant.create({
    data: {
      name: "Ancien client", plan: "PME", status: "CHURNED", billing_cycle: "MONTHLY",
      contact_email: "contact@ancien-client.ci", contact_phone: "+225 07 00 00 00 03",
      churned_at: monthsAgo(3),
      last_activity_at: daysFromNow(-40), tickets_30d: 1, tickets_90d_avg: 15,
      open_escalations: 2, escalations_over_24h: 1,
    },
  });

  // 4) Factures + paiements
  // Groupe ABC (actif) : 3 mois payés (dont le mois courant → compte dans le MRR) + 1 en attente.
  const abcPrice = PLAN_PRICE.PME;
  for (const m of [2, 1, 0]) {
    const inv = await prisma.invoice.create({
      data: {
        tenant_id: abc.id, amount_fcfa: abcPrice, status: "PAID",
        due_date: monthsAgo(m), paid_at: monthsAgo(m), notes: `Abonnement PME — ${m === 0 ? "mois en cours" : "mois -" + m}`,
      },
    });
    await prisma.payment.create({
      data: { tenant_id: abc.id, amount_fcfa: abcPrice, method: m % 2 ? "WAVE" : "ORANGE_MONEY", transaction_ref: `ABC-${inv.id.slice(-6)}`, paid_at: monthsAgo(m) },
    });
  }
  await prisma.invoice.create({
    data: { tenant_id: abc.id, amount_fcfa: abcPrice, status: "PENDING", due_date: daysFromNow(10), notes: "Prochaine échéance" },
  });

  // Beta Corp (essai) : 1 facture en attente (1re échéance), aucun paiement.
  await prisma.invoice.create({
    data: { tenant_id: beta.id, amount_fcfa: PLAN_PRICE.ESSENTIEL, status: "PENDING", due_date: daysFromNow(5), notes: "Première facture (fin d'essai)" },
  });

  // Ancien client (parti) : anciens paiements (4-6 mois) + 1 facture impayée (OVERDUE).
  const ancPrice = PLAN_PRICE.PME;
  for (const m of [6, 5, 4]) {
    await prisma.invoice.create({
      data: { tenant_id: ancien.id, amount_fcfa: ancPrice, status: "PAID", due_date: monthsAgo(m), paid_at: monthsAgo(m), notes: `Abonnement PME — mois -${m}` },
    });
    await prisma.payment.create({
      data: { tenant_id: ancien.id, amount_fcfa: ancPrice, method: "BANK_TRANSFER", transaction_ref: `ANC-${m}`, paid_at: monthsAgo(m) },
    });
  }
  await prisma.invoice.create({
    data: { tenant_id: ancien.id, amount_fcfa: ancPrice, status: "OVERDUE", due_date: monthsAgo(3), notes: "Impayé avant résiliation" },
  });

  // 5) Snapshots de santé (3 niveaux cohérents).
  const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999);
  const snapshotFor = (tenant, billingStatus) => {
    const h = computeHealth({
      tickets30d: tenant.tickets_30d, tickets90dAvg: tenant.tickets_90d_avg,
      daysSinceLastActivity: daysSince(tenant.last_activity_at),
      openEscalations: tenant.open_escalations, escalationsOver24h: tenant.escalations_over_24h,
      billingStatus,
    });
    return prisma.healthSnapshot.create({ data: { tenant_id: tenant.id, ...h } });
  };
  await snapshotFor(abc, "up_to_date");   // sain
  await snapshotFor(beta, "pending");     // à surveiller
  await snapshotFor(ancien, "overdue");   // à risque

  const [tenantCount, invoiceCount, paymentCount, snapCount] = await Promise.all([
    prisma.tenant.count(), prisma.invoice.count(), prisma.payment.count(), prisma.healthSnapshot.count(),
  ]);
  console.log(`• ${tenantCount} tenants, ${invoiceCount} factures, ${paymentCount} paiements, ${snapCount} snapshots santé.`);
  if (foUser) console.log(`• Impersonation : « Groupe ABC » reliée à ${foUser.email} (démo).`);
  console.log("✅ Seed backoffice terminé. Connexion (séparée) : admin@quitus.ci / superadmin123 → /superadmin/login");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
