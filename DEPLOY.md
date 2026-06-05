# Déploiement de Quitus — Front Vercel + Back Render

Quitus = un **frontend** statique (Vite/React) + un **backend** Node persistant
(Express + Socket.IO + PostgreSQL + uploads). Le backend **ne peut pas** tourner
sur Vercel (serverless = pas de WebSocket persistant, disque éphémère, pas de
base). On déploie donc :

- **Frontend → Vercel** (statique)
- **Backend → Render** (process Node vivant, WebSocket OK)
- **PostgreSQL → Render** (managé)

---

## 1) Backend + base sur Render

### Option A — Blueprint (recommandé)
1. Render → **New** → **Blueprint** → sélectionner le dépôt GitHub `quitus`.
   Render lit [`render.yaml`](render.yaml) : il crée le service web `quitus-api`
   (rootDir `server/`) **et** la base `quitus-db`, et injecte `DATABASE_URL`.
2. Au moment de la création, renseigner les variables marquées « sync:false » :
   - `CLIENT_URL` → **laisser vide pour l'instant** (on la remplit après Vercel, étape 3).
   - `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` → optionnels
     (vides = emails loggés en console, push désactivé).
3. Le build exécute `npm install && npm run build` (= `prisma generate` +
   `prisma migrate deploy`) puis démarre avec `npm start`.
4. **Seed initial (une fois)** : service `quitus-api` → **Shell** → `npm run seed`.
   ⚠️ À ne lancer qu'une fois : le seed réinitialise les données de démonstration.
   Les migrations (frontoffice **et** backoffice) sont appliquées automatiquement par
   `prisma migrate deploy` au build — aucune action manuelle.
5. **Backoffice éditeur (optionnel)** : pour créer le compte éditeur et des clients de
   démo → **Shell** → `npm run seed:superadmin` (compte `admin@quitus.ci`). À réserver
   à un environnement de démo : ce seed réinitialise les tenants/factures/paiements.

### Option B — manuel
- New → **PostgreSQL** (plan free) → copier l'**Internal Database URL**.
- New → **Web Service** → repo `quitus`, **Root Directory** = `server`,
  Build = `npm install && npm run build`, Start = `npm start`,
  Health check path = `/health`.
- Variables d'env : voir [`server/.env.example`](server/.env.example) +
  `DATABASE_URL` (l'URL Postgres), `JWT_SECRET` (chaîne longue aléatoire),
  `CLIENT_URL` (étape 3), `UPLOAD_DIR=uploads`.

➡️ Noter l'URL publique du backend, ex. `https://quitus-api.onrender.com`.

---

## 2) Frontend sur Vercel
1. Vercel → **Add New Project** → importer le dépôt `quitus`.
2. **Root Directory = `client`** (important : le dépôt est un monorepo).
   Le preset **Vite** est détecté (build `npm run build`, output `dist`).
   [`client/vercel.json`](client/vercel.json) gère les *rewrites* SPA.
3. Variable d'environnement : `VITE_API_URL` = l'URL Render du backend
   (ex. `https://quitus-api.onrender.com`). **Injectée au build** → redéployer
   si on la change.
4. Déployer. ➡️ Noter l'URL Vercel, ex. `https://quitus.vercel.app`.

---

## 3) Relier les deux (CORS)
- Sur **Render**, mettre `CLIENT_URL` = l'URL Vercel (ex. `https://quitus.vercel.app`).
  Plusieurs origines possibles, séparées par des virgules (domaine perso, etc.).
- Render redéploie ; le CORS REST **et** WebSocket autorisent alors le front.

---

## Caveats (plan gratuit)
- **Uploads éphémères** : sur le plan free Render, le disque est réinitialisé à
  chaque redéploiement → les pièces jointes disparaissent. Pour les conserver :
  passer le service en plan payant + monter un disque (décommenter le bloc `disk`
  de `render.yaml` et mettre `UPLOAD_DIR=/data/uploads`), **ou** brancher un
  stockage objet (S3 / Cloudflare R2).
- **Cold start** : un service free Render s'endort après inactivité (~50 s au
  réveil). Acceptable pour un usage interne ; sinon plan payant.
- **Web Push** : nécessite HTTPS (OK sur Vercel/Render) + des clés VAPID.

## Variables d'environnement — récap
| Variable | Où | Exemple |
|---|---|---|
| `DATABASE_URL` | Render (auto via Blueprint) | `postgresql://…` |
| `JWT_SECRET` | Render | chaîne longue aléatoire |
| `CLIENT_URL` | Render | `https://quitus.vercel.app` |
| `UPLOAD_DIR` | Render | `uploads` (ou `/data/uploads` si disque) |
| `RESEND_API_KEY` / VAPID_* | Render | optionnels |
| `VITE_API_URL` | Vercel | `https://quitus-api.onrender.com` |
