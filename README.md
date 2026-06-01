# Système de tickets transversal

Application web interne de gestion de tickets multi-départements (50–150 employés).
Tout employé soumet une demande via un formulaire unique, le ticket est routé
automatiquement vers le bon département, chaque département gère sa file, et
l'employé est notifié à chaque étape.

## Stack (Option B — cloud)

| Couche | Techno |
|---|---|
| Frontend | React + Vite + TailwindCSS + React Router |
| Backend | Node.js + Express |
| BDD | PostgreSQL via Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Email | Resend (SDK) — bascule SMTP/Nodemailer possible |
| Fichiers | Stub upload (S3/Cloudinary à brancher) |

## Rôles

- **employee** — soumet des tickets, suit leur statut, donne un feedback.
- **agent** — traite les tickets de **son** département uniquement.
- **admin** — vue globale, gestion des utilisateurs/départements, réassignation.

## Structure

```
ticket-system/
├── client/        # Frontend React (Vite)
└── server/        # Backend Express + Prisma
```

## Démarrage rapide

### 1. Base de données

Avoir une instance PostgreSQL accessible. Exemple local via Docker :

```bash
docker run --name ticket-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ticketdb -p 5432:5432 -d postgres:16
```

### 2. Backend

```bash
cd server
cp .env.example .env          # puis éditer DATABASE_URL, JWT_SECRET, RESEND_API_KEY...
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev                   # http://localhost:4000
```

> **Windows / PowerShell** : remplacer `cp .env.example .env` par
> `Copy-Item .env.example .env`.

### 3. Frontend

```bash
cd client
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Une fois les deux serveurs lancés, ouvrir http://localhost:5173 et se connecter
avec un compte de démo (voir tableau ci-dessous).

## Comptes de démonstration (après seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@demo.local | password123 |
| Agent IT | agent.it1@demo.local | password123 |
| Agent RH | agent.hr1@demo.local | password123 |
| Agent Finance | agent.finance1@demo.local | password123 |
| Employé | employee@demo.local | password123 |

(Un second agent par département existe aussi : `agent.it2@…`, etc.)

## Règles métier

- Un employé ne voit que ses propres tickets.
- Un agent ne voit que les tickets de son département (et leurs commentaires internes).
- Seul l'admin peut réassigner un ticket à un autre département.
- Statuts : `NEW → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED`.
- Un ticket clôturé ne peut pas être rouvert (créer un nouveau ticket).
- Le feedback (1–5 ★) n'est demandé qu'une seule fois, à la clôture.

## Routage automatique

Voir [server/services/routing.js](server/services/routing.js) — la catégorie
choisie dans le formulaire détermine le `slug` du département cible
(fallback `it`).
