// Journal d'audit append-only (best-effort : n'interrompt jamais l'action métier).
import { prisma } from "../lib/prisma.js";

export async function logEvent({ ticketId, actorId, action, detail, createdAt }) {
  try {
    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: actorId || null,
        action,
        detail: detail ? JSON.stringify(detail) : null,
        ...(createdAt ? { createdAt } : {}),
      },
    });
  } catch (err) {
    console.error("logEvent() échec:", err?.message || err);
  }
}
