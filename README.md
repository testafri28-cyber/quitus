# Quitus — gestion de tickets WCA × IDC (+ backoffice éditeur)

Application intranet de gestion de demandes pour **deux entreprises partageant un
même bâtiment** — **WCA** (bleu) et **IDC** (orange) — avec un espace **Global**
commun et un espace **Admin**. Tout collaborateur soumet une demande via un
formulaire unique ; elle est routée vers le service destinataire ; chaque service
gère sa file ; le demandeur est notifié à chaque étape. Discussion temps réel,
présence, notifications et personnalisation des couleurs par espace sont intégrées.

Le dépôt contient **deux produits** :

1. **Frontoffice (le ticketing)** — utilisé par WCA et IDC.
2. **Backoffice éditeur (SaaS)** — `/superadmin` : espace **séparé**, avec sa propre
   connexion, pour l'éditeur de Quitus (gestion des entreprises clientes,
   abonnements, facturation, revenus). Voir [Backoffice éditeur](#backoffice-éditeur-saas).

## Stack

| Couche | Techno |
|---|---|
| Frontend | React 18 + Vite + React Router — design system CSS maison (variables, thématisation par espace) |
| Temps réel | Socket.IO (discussion, présence, mentions) |
| Graphiques | Recharts (backoffice — revenus) |
| Backend | Node.js (≥ 18) + Express |
| BDD | PostgreSQL via Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Sécurité | Helmet + express-rate-limit (anti-brute-force sur les connexions) |
| Email | Resend (optionnel — sinon loggé en console) |
| Web Push | web-push / VAPID (optionnel) |
| Fichiers | Uploads disque local (S3/R2 en prod, cf. DEPLOY.md) |
| Tests | Playwright (e2e, parcours + API + sécurité) |

## Espaces & rôles

**Espaces** : `global` (commun), `wca`, `idc`, `admin`.

| Rôle | Peut |
|---|---|
| **Membre** (`MEMBER`) | Soumettre des demandes **et** intervenir sur celles de son service (prendre la main, changer le statut, commenter). |
| **Responsable** | Un membre désigné pour un service : gère la file, le salon et l'équipe du service. |
| **Admin** (`ADMIN`) | Vue consolidée des deux entreprises, gestion des utilisateurs/services, réassignation, personnalisation des couleurs. |
| **Super-admin** (backoffice) | Compte **éditeur** distinct (table séparée) — pilote les clients/abonnements/factures. N'a aucun accès au frontoffice. |

## Fonctionnalités (frontoffice)

- **Demandes** : types *Intervention* / *Besoin*, niveau d'urgence, fil d'avancement
  (`Nouveau → En cours → En attente → Résolu → Clôturé`), prise en main, transfert
  entre collègues, mise en attente du demandeur, **besoin lié** (dépendance qui ne
  pénalise pas le délai), pièces jointes **multiples**, document imprimable.
- **Commentaires** : note interne (service) ou message au demandeur ; édition/suppression
  de son propre commentaire pendant 15 min.
- **Feedback** de satisfaction (1–5 ★) à la résolution.
- **Demandes de congé** + **annuaire des services**.
- **Discussion temps réel** (Socket.IO) : salon général + salons de service, **mentions
  @**, **présence** (en ligne / indisponible / en congé), pièces jointes **convertibles
  en ticket**, gestion des salons par le responsable/admin.
- **Notifications** : cloche (statut, commentaires, transferts) + barre latérale
  (messages, mentions) ; préférences e-mail / push navigateur.
- **Recherche globale**, **pagination**, interface **responsive** (cartes sur mobile).
- **Mon compte** : profil (rôle, service, entreprise), disponibilité, mot de passe.
- **Personnalisation (admin)** : couleurs par espace (brand kit) appliquées à toute
  l'app **et** à la page de connexion.

## Structure

```
ticket-system/
├── client/     # Frontend React (Vite) — frontoffice + pages /superadmin
├── server/     # Backend Express + Prisma + Socket.IO
├── e2e/        # Tests Playwright
└── docs/       # Recette / scénarios de test
```

## Démarrage rapide

### 1. Base de données
Une instance PostgreSQL accessible. Exemple local via Docker :
```bash
docker run --name ticket-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ticketdb -p 5432:5432 -d postgres:16
```

### 2. Backend
```bash
cd server
cp .env.example .env          # éditer DATABASE_URL, JWT_SECRET, (RESEND/VAPID optionnels)
npm install
npx prisma migrate dev        # applique le schéma
npm run seed                  # données de démo du frontoffice (WCA/IDC)
npm run seed:superadmin       # (optionnel) compte éditeur + clients de démo du backoffice
npm run dev                   # http://localhost:4000
```
> **Windows / PowerShell** : remplacer `cp .env.example .env` par `Copy-Item .env.example .env`.

### 3. Frontend
```bash
cd client
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Ouvrir http://localhost:5173 et se connecter avec un compte de démo ci-dessous.

## Comptes de démonstration (après seed)

Mot de passe commun : **`password123`**.

| Rôle | Email |
|---|---|
| Admin | `adnan.moghnieh@idc.ci` |
| Responsable IT (IDC) | `boti.raoul@idc.ci` |
| Membre IT (IDC) | `yapo.arthur@idc.ci` |
| Employé WCA | `employe.wca@wca.ci` |
| Employé IDC | `employe.idc@idc.ci` |

## Backoffice éditeur (SaaS)

Espace **séparé** du frontoffice, pour l'éditeur de Quitus.

- **URL** : http://localhost:5173/superadmin (redirige vers `/superadmin/login`).
- **Connexion dédiée** : comptes dans une **table distincte** (`SuperAdmin`), jeton à
  périmètre propre — un compte client ne donne **aucun** accès, et inversement.
- **Compte de démo** (après `npm run seed:superadmin`) : `admin@quitus.ci` / `superadmin123`.

Pages (console d'opérateur, 6 modules) : **Cockpit** (file d'attention actionnable —
impayés, fins d'essai, comptes à risque, escalades — + KPIs argent/risque, santé
système et watchlist), **Comptes** (liste classée par **score de santé** + fiche
**360°** : score 0–100 et ses 4 composantes usage/engagement/support/facturation,
usage, factures, paiements, timeline, **consultation-en-tant-que**), **Facturation**
(encaissement → paiement, annulation), **Revenus** (MRR/ARR sur abonnements actifs,
churn, par plan, graphe 6 mois). Modules **Adoption / Santé / Confiance** en préparation.

**Score de santé** : calculé (service pur `computeHealth`) à partir de signaux par
compte (usage/engagement/support) + statut de facturation réel ; buckets Sain / À
surveiller / À risque. **Consultation-en-tant-que** (impersonation) : ouvre le
frontoffice via un jeton court à périmètre dédié, avec **bannière** côté client et
**journal d'audit** (début/fin) — réservée aux comptes reliés à un utilisateur.

Facturation en FCFA ; moyens de paiement : Wave, Orange Money, MTN MoMo, virement.
Les prix des plans sont en base (table `PlanPrice`) et servent au calcul du MRR/ARR ;
les factures échues passent automatiquement en *En retard* ; chaque action est tracée
dans un **journal d'audit**.

## Tests (e2e)

Suite Playwright (parcours complets, API, sécurité, responsive, backoffice). Stack
démarrée puis :
```bash
cd e2e
npm install
npx playwright install --with-deps   # une fois
npm test
```
Voir [e2e/README.md](e2e/README.md).

## Règles métier

- Un membre voit ses propres demandes **et** celles adressées à son service.
- Seul l'assigné (ou un admin) fait avancer le statut ; seul un admin réassigne le service.
- Une demande clôturée ne se rouvre pas (créer une nouvelle demande).
- Le feedback (1–5 ★) n'est demandé qu'une fois, à la résolution.

## Déploiement

Front **Vercel** + Back **Render** + PostgreSQL **Render**. Procédure détaillée :
[DEPLOY.md](DEPLOY.md).
