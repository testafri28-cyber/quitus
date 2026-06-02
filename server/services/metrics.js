// Calcul du temps passé en « En attente » (ON_HOLD) à partir du journal d'audit (événements de statut).
// Permet d'exclure ce temps du délai de résolution → « délai actif » (l'attente d'un besoin ne pénalise pas l'agent).

// statusEvents : [{ detail: '{"from":...,"to":...}', createdAt }] pour UN ticket.
export function onHoldMs(statusEvents = []) {
  const sorted = [...statusEvents].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let total = 0;
  let enteredAt = null;
  for (const e of sorted) {
    let to = null;
    try { to = JSON.parse(e.detail || "{}").to; } catch { /* detail non parsable → ignoré */ }
    if (to === "ON_HOLD") {
      enteredAt = new Date(e.createdAt).getTime();
    } else if (enteredAt != null) {
      total += new Date(e.createdAt).getTime() - enteredAt;
      enteredAt = null;
    }
  }
  return total; // ms
}

// Délai « actif » de résolution = (resolvedAt - createdAt) - temps en attente, borné à 0.
export function activeResolutionMs(ticket, statusEvents) {
  const gross = new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime();
  return Math.max(0, gross - onHoldMs(statusEvents));
}

// Regroupe une liste d'événements par ticketId.
export function groupEventsByTicket(events) {
  const map = {};
  for (const e of events) (map[e.ticketId] ||= []).push(e);
  return map;
}
