// Machine à états du cycle de demande (Lot 3) + calcul des échéances SLA (via Lot 2).
import { prisma } from "../lib/prisma.js";
import { ajouterHeuresOuvrees } from "./heuresOuvrees.js";

const EXPRESS = ["CRITIQUE", "URGENT", "HIGH"]; // HIGH = hérité, traité comme URGENT

// Décision de routage (PURE). destinationClaire = le service a été choisi explicitement.
// - Besoin (NEED) : passe TOUJOURS par la validation du responsable.
// - Intervention : entre en file si la destination est claire, sinon tri.
export function decisionRoutage({ type, urgency, destinationClaire }) {
  const express = EXPRESS.includes(urgency);
  if (type === "NEED") {
    return { statut: destinationClaire ? "EN_ATTENTE_VALIDATION" : "A_TRIER", express, entreEnFile: false };
  }
  return destinationClaire
    ? { statut: "NEW", express, entreEnFile: true }
    : { statut: "A_TRIER", express, entreEnFile: false };
}

// Échelle d'escalade (PURE) : 0 assigné → 1 responsable → 2 modérateur → 3 admin.
// Le palier 3 (admin) n'est atteint que pour CRITIQUE.
export function paliersEscalade(urgency) {
  return urgency === "CRITIQUE" ? 3 : 2;
}

const SLA_FALLBACK = { CRITIQUE: { priseEnMainH: 1, rappelH: 1, escaladeH: 2 }, URGENT: { priseEnMainH: 4, rappelH: 4, escaladeH: 6.5 }, NORMAL: { priseEnMainH: 6.5, rappelH: 6.5, escaladeH: 13 }, FAIBLE: { priseEnMainH: 19.5, rappelH: 19.5, escaladeH: 32.5 } };
const CAL_FALLBACK = { jours: [1, 2, 3, 4, 5], heureDebut: "08:00", heureFin: "16:30", pauseDebut: "12:00", pauseFin: "14:00" };
const urgencePourSLA = (u) => (u === "HIGH" ? "URGENT" : u);

// Chargement de la config (préfère la ligne spécifique à l'entreprise, sinon le défaut global).
async function chargerSLA(urgency, companyId) {
  const u = urgencePourSLA(urgency);
  const rows = await prisma.politiqueSLA.findMany({ where: { urgence: u, OR: [{ companyId }, { companyId: null }] } });
  return rows.find((r) => r.companyId === companyId) || rows.find((r) => r.companyId === null) || SLA_FALLBACK[u] || SLA_FALLBACK.NORMAL;
}
async function chargerCalendrier(companyId) {
  const rows = await prisma.calendrierOuvre.findMany({ where: { OR: [{ companyId }, { companyId: null }] } });
  return rows.find((r) => r.companyId === companyId) || rows.find((r) => r.companyId === null) || CAL_FALLBACK;
}
async function chargerFeries(companyId) {
  const rows = await prisma.jourFerie.findMany({ where: { OR: [{ companyId }, { companyId: null }] }, select: { date: true } });
  return rows.map((r) => r.date);
}

// Calcule les 3 échéances (prise en main / rappel / escalade) en heures ouvrées depuis `depart`.
export async function calculerEcheances(urgency, depart, companyId = null) {
  const [sla, cal, feries] = await Promise.all([chargerSLA(urgency, companyId), chargerCalendrier(companyId), chargerFeries(companyId)]);
  return {
    priseEnMainAvant: ajouterHeuresOuvrees(depart, sla.priseEnMainH, cal, feries),
    rappelA: ajouterHeuresOuvrees(depart, sla.rappelH, cal, feries),
    escaladeA: ajouterHeuresOuvrees(depart, sla.escaladeH, cal, feries),
  };
}

// Modérateurs CIBLABLES d'une entreprise (relève automatique sur la présence) :
// on exclut ceux en congé / indisponibles ; si aucun n'est dispo → bascule vers les admins.
export async function moderateursDisponibles(companyId) {
  const mods = await prisma.user.findMany({
    where: { companyId, peutDispatcher: true },
    select: { id: true, presence: true },
  });
  const dispo = mods.filter((m) => m.presence !== "ON_LEAVE" && m.presence !== "UNAVAILABLE");
  if (dispo.length) return dispo.map((m) => m.id);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  return admins.map((a) => a.id);
}

// Entrée en file d'un service : (ré)initialise les échéances + repart le compteur d'escalade.
export async function entreeEnFile(ticket, depart = new Date()) {
  const ech = await calculerEcheances(ticket.urgency, depart, ticket.sourceCompanyId);
  return {
    status: "NEW",
    ...ech,
    niveauEscalade: 0,
    rappelEnvoye: false,
    prisEnMainA: null,
  };
}
