// Authentification DÉDIÉE au backoffice SaaS (éditeur Quitus).
// Indépendante du frontoffice : comptes dans la table SuperAdmin, jeton à scope
// "superadmin". Un jeton frontoffice (User) ne donne donc AUCUN accès, et inversement.
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const SCOPE = "superadmin";

export function signSuperToken(superAdmin) {
  return jwt.sign({ sub: superAdmin.id, scope: SCOPE }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Vérifie le jeton du backoffice et charge le compte éditeur dans req.superAdmin.
export async function requireSuperAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentification requise." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== SCOPE) {
      return res.status(403).json({ error: "Accès réservé au backoffice éditeur." });
    }
    const admin = await prisma.superAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true },
    });
    if (!admin) return res.status(401).json({ error: "Compte introuvable." });

    req.superAdmin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }
}
