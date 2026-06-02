# Tests end-to-end Quitus (Playwright)

Parcours complets rejoués dans un vrai navigateur contre la stack en marche, plus des
contrôles de sécurité au niveau API (recherche de failles).

## Prérequis
La stack doit tourner **avant** les tests :
1. PostgreSQL portable (port 5432)
2. `cd server && npm run dev` (API + WebSocket, port 4000)
3. `cd client && npm run dev` (Vite, port 5173)

Données : comptes de démo seedés, mot de passe `password123`.

## Lancer
```bash
cd e2e
npm install               # une fois
npx playwright install chromium   # une fois
npm test                  # toute la suite
npm run test:headed       # avec navigateur visible
npm run report            # rapport HTML de la dernière exécution
```

## Couverture
- **01-auth** : redirection si non connecté, mauvais mot de passe, connexion admin/membre, déconnexion.
- **02-security** (API) : 401 sans token ; 403 cross-espace (WCA→IDC), audit réservé admin,
  modification d'utilisateur réservée admin, lecture d'un salon non autorisé, gestion d'équipe
  par non-responsable ; injection `attachmentUrl` hors `/uploads` ignorée ; anti-vol de statut.
- **03-tickets** : création via le formulaire, cycle de vie (prendre la main → résolu → clôturer),
  présence dans le tableau de bord.
- **04-chat** : message temps réel entre 2 utilisateurs, mention `@` → notification cloche,
  pièce jointe dans un message + report vers un ticket.
- **05-presence** : statut « En congé » persistant, badge « Discussion » de la sidebar en temps réel.
- **06-admin** : régression de la modale Préférences (centrée — bug `backdrop-filter` de la topbar),
  sélecteur de responsable, création/suppression d'un canal global.

## Données de test
Tout ce que les tests créent est préfixé `[E2E]` et supprimé par `global-teardown.js`
(les présences sont remises à `AVAILABLE`). Aucune pollution durable de la base.
