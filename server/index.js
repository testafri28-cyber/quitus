import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initSocket } from "./socket.js";
import { UPLOAD_DIR } from "./lib/uploads.js";
import { allowedOrigins } from "./lib/cors.js";

import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import departmentRoutes from "./routes/departments.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import settingRoutes from "./routes/settings.js";
import auditRoutes from "./routes/audit.js";
import pushRoutes from "./routes/push.js";
import chatRoutes from "./routes/chat.js";
import superadminRoutes from "./routes/superadmin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// En-têtes de sécurité. API JSON + fichiers servis vers un autre domaine (Vercel) →
// on désactive la CSP et on autorise le chargement cross-origin des ressources (uploads).
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Anti-brute-force sur la connexion : seules les tentatives ÉCHOUÉES comptent.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
});
app.use("/api/auth/login", loginLimiter);
// Même protection anti-brute-force sur la connexion du backoffice éditeur.
app.use("/api/superadmin/auth/login", loginLimiter);

// Fichiers uploadés (disque local en dev ; disque persistant ou stockage objet en prod).
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/superadmin", superadminRoutes); // backoffice SaaS (éditeur Quitus)

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});

// Handler d'erreurs centralisé
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Erreur serveur.",
  });
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initSocket(server); // Socket.IO (discussion temps réel)
server.listen(PORT, () => {
  console.log(`🚀 API + WebSocket en écoute sur http://localhost:${PORT}`);
});
