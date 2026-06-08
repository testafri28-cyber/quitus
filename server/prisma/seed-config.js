// Seed de la CONFIG routage/SLA (idempotent — ne touche pas aux demandes existantes).
// Lancer : npm run seed:config   (aussi appelé par le seed principal).
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const prisma = new PrismaClient();

// Grille SLA par défaut (heures OUVRÉES).
const SLA = [
  { urgence: "CRITIQUE", priseEnMainH: 1,    rappelH: 1,    escaladeH: 2 },
  { urgence: "URGENT",   priseEnMainH: 4,    rappelH: 4,    escaladeH: 6.5 },
  { urgence: "NORMAL",   priseEnMainH: 6.5,  rappelH: 6.5,  escaladeH: 13 },
  { urgence: "FAIBLE",   priseEnMainH: 19.5, rappelH: 19.5, escaladeH: 32.5 },
];

// Jours fériés ivoiriens 2026 (dates fixes + chrétiennes mobiles ; à compléter par les
// fêtes musulmanes mobiles — c'est de la config).
const FERIES = [
  ["2026-01-01", "Nouvel An"],
  ["2026-04-06", "Lundi de Pâques"],
  ["2026-05-01", "Fête du Travail"],
  ["2026-05-14", "Ascension"],
  ["2026-05-25", "Lundi de Pentecôte"],
  ["2026-08-07", "Fête de l'Indépendance"],
  ["2026-08-15", "Assomption"],
  ["2026-11-01", "Toussaint"],
  ["2026-11-15", "Journée nationale de la Paix"],
  ["2026-12-25", "Noël"],
];

export async function seedConfig(db = prisma) {
  // 1) Grille SLA globale (companyId null). findFirst+update/create (le NULL n'est pas
  //    contraint par l'unique Postgres → on gère l'idempotence à la main).
  for (const s of SLA) {
    const ex = await db.politiqueSLA.findFirst({ where: { companyId: null, urgence: s.urgence } });
    if (ex) await db.politiqueSLA.update({ where: { id: ex.id }, data: { priseEnMainH: s.priseEnMainH, rappelH: s.rappelH, escaladeH: s.escaladeH } });
    else await db.politiqueSLA.create({ data: { companyId: null, ...s } });
  }

  // 2) Calendrier ouvré global : lun→ven 08:00–16:30, pause 12:00–14:00.
  const calEx = await db.calendrierOuvre.findFirst({ where: { companyId: null } });
  const calData = { jours: [1, 2, 3, 4, 5], heureDebut: "08:00", heureFin: "16:30", pauseDebut: "12:00", pauseFin: "14:00" };
  if (calEx) await db.calendrierOuvre.update({ where: { id: calEx.id }, data: calData });
  else await db.calendrierOuvre.create({ data: { companyId: null, ...calData } });

  // 3) Jours fériés (idempotent par date).
  for (const [d, libelle] of FERIES) {
    const date = new Date(d + "T00:00:00.000Z");
    const ex = await db.jourFerie.findFirst({ where: { companyId: null, date } });
    if (!ex) await db.jourFerie.create({ data: { companyId: null, date, libelle } });
  }

  // 4) Modérateurs : ≥2 par entreprise (2 premiers membres) + tous les admins.
  await db.user.updateMany({ where: { role: "ADMIN" }, data: { peutDispatcher: true } });
  const companies = await db.company.findMany();
  for (const c of companies) {
    const members = await db.user.findMany({ where: { companyId: c.id, role: "MEMBER" }, take: 2, orderBy: { createdAt: "asc" } });
    if (members.length) await db.user.updateMany({ where: { id: { in: members.map((m) => m.id) } }, data: { peutDispatcher: true } });
  }

  const [slaN, ferN, dispN] = await Promise.all([
    db.politiqueSLA.count(), db.jourFerie.count(), db.user.count({ where: { peutDispatcher: true } }),
  ]);
  console.log(`• Config : ${slaN} politiques SLA, 1 calendrier, ${ferN} jours fériés, ${dispN} modérateurs.`);
}

// Exécution directe.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedConfig().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
