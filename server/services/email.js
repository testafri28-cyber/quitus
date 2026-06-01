// Service d'envoi d'emails via Resend.
// Si RESEND_API_KEY est absent (dev), les emails sont simplement loggés.

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Support <support@demo.local>";
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const resend = apiKey ? new Resend(apiKey) : null;

const STATUS_LABELS = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  ON_HOLD: "En attente",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

async function send({ to, subject, html }) {
  if (!resend) {
    console.log("📧 [DEV email — non envoyé, RESEND_API_KEY absent]");
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    return { mocked: true };
  }
  try {
    const result = await resend.emails.send({ from, to, subject, html });
    return result;
  } catch (err) {
    // Un échec d'email ne doit jamais casser la requête métier.
    console.error("Échec envoi email:", err?.message || err);
    return { error: true };
  }
}

// Notification générique (utilisée par le dispatch in-app → e-mail).
export function notifyGeneric(recipientEmail, text) {
  return send({
    to: recipientEmail,
    subject: `Quitus — ${text}`,
    html: `
      <p>Bonjour,</p>
      <p>${text}</p>
      <p><a href="${clientUrl}">Ouvrir Quitus</a></p>
      <p style="color:#888;font-size:12px">Vous recevez cet e-mail car les notifications e-mail sont activées dans vos préférences.</p>
    `,
  });
}

export function notifyTicketCreated(ticket, recipientEmail) {
  return send({
    to: recipientEmail,
    subject: `Ticket ${ticket.reference} créé — ${ticket.title}`,
    html: `
      <p>Bonjour,</p>
      <p>Votre demande a bien été enregistrée sous le numéro
         <strong>${ticket.reference}</strong>.</p>
      <p><strong>Titre :</strong> ${ticket.title}<br/>
         <strong>Statut :</strong> ${STATUS_LABELS[ticket.status] || ticket.status}</p>
      <p>Vous serez notifié de l'avancement.</p>
      <p><a href="${clientUrl}/tickets/${ticket.id}">Suivre mon ticket</a></p>
    `,
  });
}

export function notifyStatusChanged(ticket, recipientEmail) {
  return send({
    to: recipientEmail,
    subject: `Ticket ${ticket.reference} — statut : ${STATUS_LABELS[ticket.status] || ticket.status}`,
    html: `
      <p>Bonjour,</p>
      <p>Le statut de votre ticket <strong>${ticket.reference}</strong>
         (${ticket.title}) est passé à
         <strong>${STATUS_LABELS[ticket.status] || ticket.status}</strong>.</p>
      <p><a href="${clientUrl}/tickets/${ticket.id}">Voir le ticket</a></p>
    `,
  });
}

export function notifyTicketClosed(ticket, recipientEmail) {
  return send({
    to: recipientEmail,
    subject: `Ticket ${ticket.reference} clôturé — votre avis compte`,
    html: `
      <p>Bonjour,</p>
      <p>Votre ticket <strong>${ticket.reference}</strong> (${ticket.title})
         a été clôturé.</p>
      <p>Merci de prendre un instant pour évaluer la qualité du traitement :</p>
      <p><a href="${clientUrl}/tickets/${ticket.id}?feedback=1">Donner mon avis (1 à 5 étoiles)</a></p>
    `,
  });
}
