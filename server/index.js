import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import departmentRoutes from "./routes/departments.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notifications.js";
import settingRoutes from "./routes/settings.js";
import auditRoutes from "./routes/audit.js";
import pushRoutes from "./routes/push.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// Fichiers uploadés (stub local). Brancher S3/Cloudinary en prod.
const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(__dirname, uploadDir)));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/push", pushRoutes);

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
app.listen(PORT, () => {
  console.log(`🚀 API en écoute sur http://localhost:${PORT}`);
});
