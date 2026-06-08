// Notification multi-canal, CLOCHE-FIRST (Lot 4).
// - écrit toujours une Notification (cloche) + l'émet en temps réel (via notify()),
// - amplifie e-mail (si Resend configuré) et push (si VAPID), selon les préférences,
// - dégrade silencieusement si une brique est absente (la cloche suffit).
// Rappels et escalades restent au minimum dans la cloche, non désactivables.
import { notify } from "./notify.js";

function texteDefaut(evenement, demande) {
  const t = demande?.title || "votre demande";
  switch (evenement) {
    case "rappel":             return `Rappel : « ${t} » attend une prise en main.`;
    case "escalade":           return `Escalade : « ${t} » n'a pas été prise en main dans les délais.`;
    case "a_trier":            return `Nouvelle demande à trier : « ${t} ».`;
    case "validation_requise": return `Un besoin attend votre validation : « ${t} ».`;
    case "valide":             return `Votre besoin « ${t} » a été validé — il entre en file.`;
    case "refuse":             return `Votre besoin « ${t} » a été refusé.`;
    case "nouvelle_demande":   return `Nouvelle demande « ${t} » dans votre service.`;
    default:                   return `Mise à jour sur « ${t} ».`;
  }
}

// destinataires : id(s) d'utilisateur ou objet(s) { id }. demande : le ticket.
export async function notifier({ evenement, destinataires, demande, texte }) {
  const list = Array.isArray(destinataires) ? destinataires : [destinataires];
  const ids = list.map((d) => (d && typeof d === "object" ? d.id : d)).filter(Boolean);
  if (!ids.length) return;
  await notify(ids, { type: evenement, text: texte || texteDefaut(evenement, demande), ticketId: demande?.id });
}
