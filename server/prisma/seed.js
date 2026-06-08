import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveServiceCode } from "../services/routing.js";
import { seedConfig } from "./seed-config.js";
// Note : on insère les TicketEvent directement (prisma) pour pouvoir backdater l'événement « created ».

const prisma = new PrismaClient();
const PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  /* ---------------- Entreprises ---------------- */
  const companiesData = [
    { name: "WCA", slug: "wca", color: "#378ADD" },
    { name: "IDC", slug: "idc", color: "#EF9F27" },
  ];
  const companies = {};
  for (const c of companiesData) {
    companies[c.slug] = await prisma.company.upsert({
      where: { slug: c.slug },
      update: { name: c.name, color: c.color },
      create: c,
    });
  }

  /* ---------------- Services ---------------- */
  const sharedDepts = [
    { name: "Informatique", code: "it" },
    { name: "Web & Design", code: "design" },
    { name: "Ressources Humaines", code: "rh" },
    { name: "Juridique", code: "juridique" },
    { name: "Finance & Comptabilité", code: "finance" },
    { name: "Direction", code: "direction" },
  ];
  const wcaDepts = [
    { name: "Finance & Administration", code: "wca-daf" },
    { name: "Exploitation HCL", code: "wca-expl-hcl" },
    { name: "Exploitation Marchandises", code: "wca-expl-marchandises" },
    { name: "QHSE", code: "wca-qhse" },
    { name: "OBC", code: "wca-obc" },
    { name: "Logistique & Parc", code: "wca-log-parc" },
    { name: "Maintenance / Mécanique", code: "wca-maintenance" },
  ];
  const idcDepts = [
    { name: "Contrôle de Gestion", code: "idc-controle-gestion" },
    { name: "Trésorerie & Boutique", code: "idc-tresorerie" },
    { name: "Cartes TPE", code: "idc-tpe" },
    { name: "Réseau", code: "idc-reseau" },
    { name: "Développement Réseau", code: "idc-dev-reseau" },
    { name: "Gestion Stock", code: "idc-stock" },
    { name: "Commercial", code: "idc-commercial" },
    { name: "Marketing", code: "idc-marketing" },
  ];

  const depts = {}; // code -> Department
  async function upsertDept(d, companyId) {
    depts[d.code] = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, companyId },
      create: { ...d, companyId },
    });
  }
  for (const d of sharedDepts) await upsertDept(d, null);
  for (const d of wcaDepts) await upsertDept(d, companies.wca.id);
  for (const d of idcDepts) await upsertDept(d, companies.idc.id);

  /* ---------------- Admin global ---------------- */
  const admin = await prisma.user.upsert({
    where: { email: "adnan.moghnieh@idc.ci" },
    update: {},
    create: {
      name: "Adnan Moghnieh",
      email: "adnan.moghnieh@idc.ci",
      passwordHash,
      role: "ADMIN",
      companyId: companies.idc.id,
      departmentId: depts["direction"].id,
    },
  });

  /* ---------------- Membres (tout le monde : demande ET intervient) ----------------
     Chaque membre appartient à un service. Plusieurs membres peuvent partager un
     service (ex. IT : Boti + Yapo) → ils voient tous les tickets de ce service. */
  const membersData = [
    { name: "Boti Raoul", email: "boti.raoul@idc.ci", dept: "it", company: "idc" },
    { name: "Yapo Arthur", email: "yapo.arthur@idc.ci", dept: "it", company: "idc" },
    { name: "N'gnankou Evrard", email: "ngnankou.evrard@idc.ci", dept: "design", company: "idc" },
    { name: "Éboulé Jacqueline", email: "eboule.jacqueline@wca.ci", dept: "rh", company: "wca" },
    { name: "Ouattara Zié", email: "ouattara.zie@wca.ci", dept: "juridique", company: "wca" },
    { name: "Ébouat Guy", email: "ebouat.guy@wca.ci", dept: "finance", company: "wca" },
    { name: "Koffi Brou", email: "employe.wca@wca.ci", dept: "wca-log-parc", company: "wca" },
    { name: "Salif Diallo", email: "salif.diallo@wca.ci", dept: "wca-log-parc", company: "wca" }, // 2e membre WCA même service (tests intra)
    { name: "Aya Touré", email: "employe.idc@idc.ci", dept: "idc-reseau", company: "idc" },
  ];
  const memberByDept = {}; // code -> premier membre du service (pour pré-assigner des tickets)
  const employees = {}; // companySlug -> un membre (émetteur des tickets de démo)
  for (const m of membersData) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { role: "MEMBER", companyId: companies[m.company].id, departmentId: depts[m.dept].id },
      create: {
        name: m.name,
        email: m.email,
        passwordHash,
        role: "MEMBER",
        companyId: companies[m.company].id,
        departmentId: depts[m.dept].id,
      },
    });
    if (!memberByDept[m.dept]) memberByDept[m.dept] = user;
    if (!employees[m.company]) employees[m.company] = user; // premier membre de l'entreprise = émetteur démo
  }

  /* ---------------- Responsables de service + salons ---------------- */
  // Responsable = premier membre du service (l'admin pourra le changer ensuite).
  for (const [code, member] of Object.entries(memberByDept)) {
    await prisma.department.update({ where: { id: depts[code].id }, data: { responsibleId: member.id } });
  }
  // Salon global (un seul).
  const existingGlobal = await prisma.chatRoom.findFirst({ where: { scope: "GLOBAL" } });
  if (!existingGlobal) {
    await prisma.chatRoom.create({ data: { name: "Salon général", scope: "GLOBAL" } });
  }
  // Salons de démo pour les services à 2 membres (IT, Logistique & Parc).
  for (const code of ["it", "wca-log-parc"]) {
    await prisma.chatRoom.upsert({
      where: { departmentId: depts[code].id },
      update: {},
      create: { name: depts[code].name, scope: "DEPARTMENT", departmentId: depts[code].id },
    });
  }

  /* ---------------- 10 tickets exemples ---------------- */
  // sourceCompany = entreprise de l'employé émetteur ; department = routage par catégorie.
  // `ago` = ancienneté en jours (pour démontrer les alertes : urgentes, anciennes non assignées, traitements qui traînent).
  const ticketsSeed = [
    { from: "wca", space: "WCA", type: "INTERVENTION", category: "Problème informatique (PC, logiciel, accès, réseau)", title: "PC ne démarre plus", description: "Écran noir au démarrage, aucun bip.", urgency: "HIGH", status: "IN_PROGRESS", ago: 5 },
    { from: "idc", space: "IDC", type: "INTERVENTION", category: "Problème informatique (PC, logiciel, accès, réseau)", title: "Réinitialisation accès VPN", description: "Impossible de me connecter au VPN depuis ce matin.", urgency: "URGENT", status: "NEW", ago: 2 },
    { from: "wca", space: "GLOBAL", type: "NEED", category: "Demande web ou design", title: "Bannière pour le site WCA", description: "Besoin d'une bannière pour la campagne logistique.", urgency: "NORMAL", status: "RESOLVED", ago: 6 },
    { from: "idc", space: "IDC", type: "NEED", category: "Congés / contrat / question RH", title: "Solde de congés", description: "Combien de jours me reste-t-il cette année ?", urgency: "NORMAL", status: "ON_HOLD", ago: 4 },
    { from: "wca", space: "WCA", type: "NEED", category: "Note de frais / demande comptable", title: "Note de frais déplacement Abidjan", description: "Remboursement du déplacement client.", urgency: "NORMAL", status: "CLOSED", ago: 8 },
    { from: "idc", space: "IDC", type: "NEED", category: "Question ou litige juridique", title: "Avis juridique contrat fournisseur", description: "Clause de pénalité à valider avant signature.", urgency: "HIGH", status: "IN_PROGRESS", ago: 4 },
    { from: "wca", space: "WCA", type: "INTERVENTION", category: "Maintenance / Mécanique", title: "Camion 4582-CI en panne", description: "Fuite d'huile détectée au parc.", urgency: "URGENT", status: "NEW", ago: 2 },
    { from: "wca", space: "GLOBAL", type: "NEED", category: "Gestion Stock", title: "Demande de pièce détachée (cross IDC)", description: "Employé WCA sollicitant le stock IDC via l'espace global.", urgency: "NORMAL", status: "NEW", ago: 3 },
    { from: "wca", space: "WCA", type: "INTERVENTION", category: "QHSE / Sécurité", title: "Incident sécurité entrepôt", description: "Palette mal arrimée, risque de chute.", urgency: "HIGH", status: "NEW", ago: 0 },
    { from: "idc", space: "IDC", type: "INTERVENTION", category: "Cartes TPE", title: "Carte TPE défectueuse station Yopougon", description: "Le terminal refuse toutes les cartes.", urgency: "NORMAL", status: "RESOLVED", ago: 5 },
  ];

  let counter = 1;
  for (const t of ticketsSeed) {
    const reference = `TCK-${String(counter).padStart(6, "0")}`;
    counter++;

    const serviceCode = resolveServiceCode(t.category);
    const dept = depts[serviceCode];
    const submitter = employees[t.from];
    const member = memberByDept[serviceCode];
    const assigned = t.status !== "NEW" && member ? member.id : null;
    const resolved = t.status === "RESOLVED" || t.status === "CLOSED";
    const createdAt = new Date(Date.now() - (t.ago || 0) * 86400000);

    const ticket = await prisma.ticket.upsert({
      where: { reference },
      update: {},
      create: {
        reference,
        title: t.title,
        description: t.description,
        category: t.category,
        type: t.type,
        urgency: t.urgency,
        status: t.status,
        sourceSpace: t.space,
        sourceCompanyId: companies[t.from].id,
        departmentId: dept.id,
        submittedById: submitter.id,
        assignedToId: assigned,
        createdAt,
        resolvedAt: resolved ? new Date() : null,
      },
    });

    if (assigned) {
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: assigned,
          content: "Prise en charge — investigation en cours.",
          isInternal: true,
        },
      });
    }
    if (t.status === "CLOSED") {
      await prisma.feedback.upsert({
        where: { ticketId: ticket.id },
        update: {},
        create: { ticketId: ticket.id, rating: 4, comment: "Traité rapidement, merci." },
      });
    }

    // Journal d'audit (idempotent : on régénère pour ce ticket).
    await prisma.ticketEvent.deleteMany({ where: { ticketId: ticket.id } });
    const evs = [{ action: "created", actorId: submitter.id, createdAt }];
    if (assigned) evs.push({ action: "assigned", actorId: assigned, detail: { assignee: member.name, self: true } });
    if (t.status === "ON_HOLD") evs.push({ action: "status", actorId: assigned, detail: { from: "IN_PROGRESS", to: "ON_HOLD" } });
    if (resolved) evs.push({ action: "status", actorId: assigned || submitter.id, detail: { from: "IN_PROGRESS", to: "RESOLVED" } });
    if (t.status === "CLOSED") evs.push({ action: "status", actorId: assigned || submitter.id, detail: { from: "RESOLVED", to: "CLOSED" } });
    await prisma.ticketEvent.createMany({
      data: evs.map((e) => ({
        ticketId: ticket.id,
        actorId: e.actorId || null,
        action: e.action,
        detail: e.detail ? JSON.stringify(e.detail) : null,
        ...(e.createdAt ? { createdAt: e.createdAt } : {}),
      })),
    });
  }

  console.log("✅ Seed terminé.");
  console.log(`   Entreprises : ${companiesData.length} (WCA, IDC)`);
  console.log(`   Services    : ${sharedDepts.length + wcaDepts.length + idcDepts.length}`);
  console.log(`   Admin       : adnan.moghnieh@idc.ci`);
  console.log(`   Membres     : boti.raoul@idc.ci + yapo.arthur@idc.ci (service IT),`);
  console.log(`                 ngnankou.evrard@idc.ci, eboule.jacqueline@wca.ci,`);
  console.log(`                 ouattara.zie@wca.ci, ebouat.guy@wca.ci,`);
  console.log(`                 employe.wca@wca.ci + salif.diallo@wca.ci (Logistique WCA), employe.idc@idc.ci (Réseau)`);
  console.log(`   Mot de passe: ${PASSWORD}`);

  // Config routage/SLA (grille SLA, calendrier ouvré, jours fériés, modérateurs).
  await seedConfig(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
