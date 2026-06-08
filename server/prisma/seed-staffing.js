// Dotation des services : complète chaque service à 3 membres et désigne un responsable.
// Idempotent (n'ajoute que ce qui manque). Lancer : npm run seed:staffing
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";

const prisma = new PrismaClient();
const PASSWORD = "password123";
const CIBLE = 3; // membres visés par service

const PRENOMS = ["Kouadio", "Aya", "Koffi", "Adjoua", "Yao", "Akissi", "Konan", "Affoué", "Brou", "Amenan", "N'Guessan", "Adjo", "Kouamé", "Ahou", "Kouassi", "Akossi", "Tanoh", "Mariam", "Ibrahim", "Fatou", "Issouf", "Awa", "Seydou", "Rokia", "Bakary", "Salimata", "Adama", "Kadidja", "Drissa", "Aminata"];
const NOMS = ["Koné", "Traoré", "Ouattara", "Diabaté", "Bamba", "Coulibaly", "Yao", "Kouamé", "Aka", "Gnagne", "Touré", "Cissé", "Soro", "Fofana", "Doumbia", "Konaté", "Brou", "Assi", "Kéita", "Sangaré", "Yapi", "Ekra", "Tano", "Niamké", "Adou", "Gbané", "Loukou", "Méité", "Bakayoko", "Affia"];

export async function seedStaffing(db = prisma) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const companies = await db.company.findMany({ select: { id: true, slug: true } });
  const bySlug = Object.fromEntries(companies.map((c) => [c.slug, c.id]));
  const deps = await db.department.findMany({ orderBy: { name: "asc" } });

  let k = 0;            // compteur global pour des noms variés
  let commun = 0;       // alterne idc/wca pour les services communs
  let crees = 0, respos = 0;

  for (const dep of deps) {
    const existants = await db.user.findMany({ where: { departmentId: dep.id, role: "MEMBER" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    const aCreer = Math.max(0, CIBLE - existants.length);
    const nouveaux = [];

    for (let i = 0; i < aCreer; i++) {
      // Entreprise : celle du service, ou alternance idc/wca pour un service commun.
      const slug = dep.companyId
        ? (companies.find((c) => c.id === dep.companyId)?.slug)
        : (commun++ % 2 === 0 ? "idc" : "wca");
      const companyId = dep.companyId || bySlug[slug];
      const prenom = PRENOMS[k % PRENOMS.length];
      const nom = NOMS[(Math.floor(k / PRENOMS.length) + k) % NOMS.length]; // paires uniques (jusqu'à 30×30)
      k++;
      const email = `${dep.code}-g${existants.length + i + 1}@${slug}.ci`;
      try {
        const u = await db.user.create({
          data: { name: `${prenom} ${nom}`, email, passwordHash, role: "MEMBER", companyId, departmentId: dep.id },
          select: { id: true },
        });
        nouveaux.push(u.id);
        crees++;
      } catch (e) {
        if (e.code !== "P2002") throw e; // déjà créé → on ignore (idempotent)
      }
    }

    // Responsable : on garde l'existant ; sinon on nomme le 1er NOUVEAU membre
    // (évite de promouvoir des membres explicitement « employés »).
    if (!dep.responsibleId) {
      const respId = nouveaux[0] || existants[0]?.id;
      if (respId) { await db.department.update({ where: { id: dep.id }, data: { responsibleId: respId } }); respos++; }
    }
  }

  const total = await db.user.count({ where: { role: "MEMBER" } });
  console.log(`• Dotation : ${crees} membres créés, ${respos} responsables désignés. ${total} membres au total.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedStaffing().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
