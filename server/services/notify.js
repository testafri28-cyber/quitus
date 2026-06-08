// Création de notifications (best-effort : n'interrompt jamais l'action métier).
import { prisma } from "../lib/prisma.js";
import { sendPushToSubs } from "./push.js";
import { notifyGeneric } from "./email.js";
import { emitToUsers } from "../socket.js";

export const STATUS_LABELS = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  ON_HOLD: "En attente",
  RESOLVED: "Résolu",
  CLOSED: "Clôturé",
};

// Crée une notification pour chaque destinataire (dédupliqué, valeurs nulles ignorées).
export async function notify(userIds, { type, text, ticketId }) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type, text, ticketId: ticketId || null })),
    });

    // Cloche en TEMPS RÉEL (la cloche est le socle : toujours émise).
    emitToUsers(ids, "notif:new", { type, text, ticketId: ticketId || null });

    // Dispatch hors-site selon les préférences de chaque destinataire.
    const recips = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, notifyEmail: true, notifyPush: true, pushSubscriptions: true },
    });
    const payload = { title: "Quitus", body: text, ticketId: ticketId || null };
    for (const u of recips) {
      if (u.notifyEmail && u.email) notifyGeneric(u.email, text); // best-effort (send() capture les erreurs)
      if (u.notifyPush && u.pushSubscriptions.length) await sendPushToSubs(u.pushSubscriptions, payload);
    }
  } catch (err) {
    console.error("notify() échec:", err?.message || err);
  }
}

// Ids des membres d'un service (option : exclure certains).
export async function serviceMemberIds(departmentId, exclude = []) {
  if (!departmentId) return [];
  const ex = new Set(exclude.filter(Boolean));
  const members = await prisma.user.findMany({
    where: { departmentId, role: "MEMBER" },
    select: { id: true },
  });
  return members.map((m) => m.id).filter((id) => !ex.has(id));
}
