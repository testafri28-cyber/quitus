import { PrismaClient } from "@prisma/client";

// Singleton Prisma (évite la multiplication des connexions en dev avec --watch)
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
