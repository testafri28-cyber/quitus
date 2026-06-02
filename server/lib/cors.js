// Origines autorisées pour le CORS (REST + Socket.IO).
// CLIENT_URL peut contenir plusieurs URLs séparées par des virgules
// (ex. domaine de prod + domaine personnalisé). Défaut : front Vite local.
export const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
