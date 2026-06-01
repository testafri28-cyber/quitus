import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

// Vérifie le JWT du header Authorization: Bearer <token>
// et charge l'utilisateur courant dans req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Token manquant." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        departmentId: true,
        company: { select: { slug: true } },
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Utilisateur introuvable." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalide ou expiré." });
  }
}
