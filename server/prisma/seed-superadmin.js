// Seed séparé pour tester le backoffice SaaS (éditeur Quitus).
// Crée 1 compte éditeur (table SuperAdmin, indépendante du frontoffice) + 3 tenants
// de démo avec factures et paiements.
// Lancer : npm run seed:superadmin   (ou : node prisma/seed-superadmin.js)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  await prisma.superAdminAudit.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 3) Tenants de démo (les entreprises qui PAIENT pour utiliser Quitus)
  const abc = await prisma.tenant.create({
    data: {
      name: "Groupe ABC", plan: "PME", status: "ACTIVE", billing_cycle: "MONTHLY",
      contact_email: "dsi@groupe-abc.ci", contact_phone: "+225 07 00 00 00 01",
      next_renewal: daysFromNow(20),
    },
  });
  const beta = await prisma.tenant.create({
    data: {
      name: "Beta Corp", plan: "ESSENTIEL", status: "TRIAL", billing_cycle: "MONTHLY",
      contact_email: "it@beta-corp.ci", contact_phone: "+225 07 00 00 00 02",
      trial_ends_at: daysFromNow(5),
    },
  });
  const ancien = await prisma.tenant.create({
    data: {
      name: "Ancien client", plan: "PME", status: "CHURNED", billing_cycle: "MONTHLY",
      contact_email: "contact@ancien-client.ci", contact_phone: "+225 07 00 00 00 03",
      churned_at: monthsAgo(3),
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

  const [tenantCount, invoiceCount, paymentCount] = await Promise.all([
    prisma.tenant.count(), prisma.invoice.count(), prisma.payment.count(),
  ]);
  console.log(`• ${tenantCount} tenants, ${invoiceCount} factures, ${paymentCount} paiements.`);
  console.log("✅ Seed backoffice terminé. Connexion (séparée) : admin@quitus.ci / superadmin123 → /superadmin/login");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
