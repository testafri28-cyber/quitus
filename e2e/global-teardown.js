// Nettoie les données créées par les tests (préfixe « [E2E] ») et remet les présences à AVAILABLE.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(here, "../server/.env") }); // DATABASE_URL pour Prisma

export default async function globalTeardown() {
  try {
    const { prisma } = await import("../server/lib/prisma.js");
    await prisma.notification.deleteMany({ where: { text: { contains: "[E2E]" } } });
    await prisma.chatMessage.deleteMany({ where: { content: { contains: "[E2E]" } } });
    await prisma.chatRoom.deleteMany({ where: { name: { contains: "[E2E]" } } });
    await prisma.ticket.deleteMany({ where: { title: { contains: "[E2E]" } } });
    await prisma.user.updateMany({ where: { presence: { not: "AVAILABLE" } }, data: { presence: "AVAILABLE" } });
    await prisma.$disconnect();
    console.log("[e2e] nettoyage des données de test terminé.");
  } catch (e) {
    console.warn("[e2e] nettoyage ignoré:", e?.message || e);
  }
}
