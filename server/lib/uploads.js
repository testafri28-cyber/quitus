import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dossier de stockage des pièces jointes, résolu une seule fois.
// UPLOAD_DIR peut être relatif (dev : "uploads" → server/uploads) ou ABSOLU
// (prod : ex. "/data/uploads" sur un disque persistant Render).
const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = process.env.UPLOAD_DIR || "uploads";

export const UPLOAD_DIR = path.isAbsolute(raw) ? raw : path.join(serverRoot, raw);

// Garantit l'existence du dossier (un disque monté peut être vide au démarrage).
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.error("Création du dossier d'uploads impossible:", e?.message || e);
}
