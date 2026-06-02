// Vérifie que la stack est joignable avant de lancer la suite (message clair sinon).
export default async function globalSetup() {
  const checks = [
    ["Frontend (Vite)", "http://localhost:5173", [200]],
    ["Backend (API)", "http://127.0.0.1:4000/api/auth/me", [401]], // 401 = route vivante, auth requise
  ];
  for (const [name, url, okCodes] of checks) {
    try {
      const r = await fetch(url);
      if (!okCodes.includes(r.status)) throw new Error(`statut ${r.status}`);
    } catch (e) {
      throw new Error(
        `\n\n[e2e] ${name} injoignable à ${url} (${e.message}).\n` +
        `Démarrez d'abord la stack :\n` +
        `  1) Postgres portable\n  2) cd server && npm run dev\n  3) cd client && npm run dev\n`
      );
    }
  }
}
