# Quitus — Scénarios de test (recette)

Guide de test manuel pour valider le système de bout en bout.
**Application : https://quitus-x1tz.vercel.app**

> ⏳ **Au premier accès**, l'application peut mettre **~50 secondes** à démarrer
> (hébergement gratuit qui se met en veille). Si la page « rame » au tout début,
> patientez et réessayez — ensuite tout est rapide.

---

## 1. Comptes pour tester

**Mot de passe pour tous : `password123`**

### Administrateurs (vous)
| Personne | E-mail |
|---|---|
| Bachar Moghnieh (DGA) | `bachar.moghnieh@idc.ci` |
| Salomé Delmotte | `salome.delmotte@idc.ci` |

### Comptes de démonstration (pour jouer les autres rôles)
| Nom | E-mail | Rôle / Service |
|---|---|---|
| Boti Raoul | `boti.raoul@idc.ci` | Membre — **responsable** Informatique |
| Yapo Arthur | `yapo.arthur@idc.ci` | Membre — Informatique |
| Koffi Brou | `employe.wca@wca.ci` | Membre — **responsable** Logistique (WCA) |
| Aya Touré | `employe.idc@idc.ci` | Membre — Réseau (IDC) |
| Éboulé Jacqueline | `eboule.jacqueline@wca.ci` | Membre — **responsable** RH (WCA) |

> 💡 Pour les tests **« à deux »** (temps réel, mentions, présence), ouvrez deux
> navigateurs différents (ou une fenêtre **privée/incognito**) connectés avec
> deux comptes distincts.

---

## 2. Comment remplir cette recette
Pour chaque scénario, notez le résultat : **OK** / **KO** + une remarque si besoin.

| # | Scénario | Résultat | Remarque |
|---|---|---|---|
| | _exemple_ | OK | _RAS_ |

---

## 3. Répartition suggérée
- **Bachar (DGA)** : pilotage & administration → scénarios **A, F, G, H** (indicateurs, utilisateurs, apparence/marque, audit).
- **Salomé** : parcours utilisateur & traitement → scénarios **B, C, D, E**.
- Faites **au moins un scénario « à deux »** ensemble (D-2, D-3, E-2).

---

## A. Connexion & navigation
**A-1. Connexion**
1. Ouvrir l'app, entrer un e-mail invalide / mot de passe court → un message d'erreur s'affiche **sous le formulaire** (le design ne casse pas).
2. Se connecter avec `bachar.moghnieh@idc.ci` / `password123`.
   - ✅ *Attendu* : redirection automatique vers votre espace, le menu de gauche s'affiche.

**A-2. Changer d'espace** (en haut à gauche, sur le logo/monogramme)
1. Ouvrir le sélecteur d'espace → choisir **WCA**, puis **IDC**, puis **Global**.
   - ✅ *Attendu* : l'accent de couleur change selon l'espace ; le contenu (file de tickets) correspond à l'espace.

**A-3. Déconnexion** (icône en haut à droite) → retour à l'écran de connexion.

---

## B. Créer une demande
**B-1. Intervention**
1. Menu **Nouvelle demande**.
2. Type **Intervention** → titre « Test — imprimante en panne » → choisir un **service** (ex. Informatique) → urgence **Haute** → description.
3. Soumettre.
   - ✅ *Attendu* : message « Demande soumise avec succès » ; la demande apparaît dans le tableau de bord.

**B-2. Besoin + pièce jointe**
1. Nouvelle demande → type **Besoin** → titre « Test — nouveau clavier » → service → **joindre un fichier** (PDF/image).
2. Soumettre, ouvrir la demande créée.
   - ✅ *Attendu* : la pièce jointe est visible et **téléchargeable** dans la demande.

---

## C. Traiter une demande (côté service)
> Connectez-vous avec un **membre du service destinataire** (ex. `boti.raoul@idc.ci` pour Informatique).

**C-1. Prendre en main → résoudre → clôturer**
1. Ouvrir une demande **Nouvelle** adressée à votre service → **Prendre la main**.
   - ✅ Le fil d'avancement passe à **En cours** ; vous êtes l'assigné.
2. **Marquer résolu**, puis **Clôturer**.
   - ✅ Le fil d'avancement progresse (Résolu → Clôturé) ; le demandeur est notifié.

**C-2. Demander une info au demandeur**
1. Sur une demande prise en main → bloc **Commentaires** → onglet **Message au demandeur** → écrire une question → Envoyer.
   - ✅ *Attendu* : le **demandeur** (autre compte) reçoit une **notification** (cloche) et voit le message ; il peut répondre.

**C-3. Mettre en attente + besoin lié**
1. Sur la demande **En cours** → **Mettre en attente du demandeur**.
   - ✅ Le statut passe à **En attente** (ambre) ; un bouton **Reprendre** apparaît.
2. Cliquer **Créer un besoin lié** → soumettre le besoin.
   - ✅ La fiche affiche une carte **Dépendances** reliant les deux demandes.

**C-4. Anti-« vol »** (à deux, même service)
1. Boti prend une demande. Avec **Yapo** (même service), essayer de changer le statut de **cette** demande.
   - ✅ *Attendu* : refus (« pris en charge par un collègue ») — seul l'assigné/admin change le statut.

---

## D. Discussion (chat)
**D-1. Envoyer un message** : menu **Discussion** → salon **Salon général** → écrire un message.

**D-2. Temps réel (à deux)** : Boti et Yapo dans le **Salon général**.
   - ✅ Le message de l'un apparaît **instantanément** chez l'autre.

**D-3. Mention @ (à deux)** : Boti tape `@` puis « Yapo », choisit Yapo, envoie.
   - ✅ *Attendu* : chez Yapo, **« @ » sur l'item Discussion** + une **notification** « X vous a mentionné » dans la cloche.

**D-4. Pièce jointe → ticket** : dans un salon, **joindre un fichier**, envoyer ; puis sur le message, **Ticket**.
   - ✅ Le formulaire de demande s'ouvre avec la **pièce jointe reprise**.

**D-5. Disponibilité** : en haut de la liste des salons, changer son statut en **En congé** / **Indisponible**.
   - ✅ Le statut est visible (pastille) ; persiste après rechargement.

---

## E. Notifications
**E-1. Cloche** : après un commentaire/transfert sur une de vos demandes, la **cloche** (en haut) affiche une notification ; cliquer dessus ouvre la demande **à la bonne section**.

**E-2. Badge Discussion (à deux)** : pendant que vous êtes **hors** du chat, un collègue écrit dans un salon que vous suivez.
   - ✅ Un **compteur** apparaît sur l'item **Discussion** du menu.

---

## F. Administration — Gestion
> Avec un compte **Admin** (Bachar ou Salomé) → menu **Gestion**.

**F-1. Utilisateurs** : onglet **Utilisateurs** → créer un utilisateur (membre, entreprise, service) ; changer un **rôle** ; changer le **service** d'un membre.
**F-2. Services & entreprises** : créer une entreprise (avec couleur), créer un service, désigner un **responsable** ; supprimer un service de test.
**F-3. Paramètres** : activer/désactiver **« Suggérer un membre »** → vérifier l'effet dans le formulaire de demande.
**F-4. Indicateurs / Performance / Audit** : consulter les chiffres ; exporter l'**audit en CSV**.

---

## G. Apparence (marque / brand kit)
> **Gestion → Apparence** (Admin).

**G-1. Changer la couleur principale** → l'aperçu se met à jour ; **Enregistrer**.
   - ✅ *Attendu* : toute l'app **et la page de connexion** prennent la nouvelle couleur.
**G-2. Couleur WCA / IDC** → enregistrer.
   - ✅ Dans l'espace concerné, accents **et badges d'entreprise** suivent la couleur.
**G-3. Réinitialiser (défaut)** → retour aux couleurs d'origine.

---

## H. Responsable d'équipe
> Avec un **responsable** (ex. `boti.raoul@idc.ci` pour Informatique) → **Discussion**, salon de son service.

**H-1. Gérer l'équipe** : bouton **Gérer l'équipe** → ajouter / retirer un membre.
**H-2. Gérer le salon** : **Renommer**, **Archiver**, **Supprimer** le salon ; le recréer.

---

## I. Mobile / responsive
1. Ouvrir l'app sur **téléphone** (ou réduire la fenêtre).
   - ✅ Le menu devient un **tiroir** (bouton ☰) ; les écrans restent lisibles, sans débordement.

---

## Bilan
- Nombre de scénarios OK : ___ / KO : ___
- Anomalies / remarques principales :
  1. …
  2. …
- Suggestions d'amélioration :
  1. …
