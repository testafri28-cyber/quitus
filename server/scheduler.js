// Scheduler des rappels & escalades (Lot 5). Compare `now` aux échéances déjà calculées
// en heures ouvrées (il ne « décompte » pas en temps réel). Cadence ~5 min.
import { prisma } from "./lib/prisma.js";
import { notifier } from "./services/notifier.js";
import { serviceMemberIds } from "./services/notify.js";
import { calculerEcheances, paliersEscalade, moderateursDisponibles } from "./services/cycleDemande.js";

// Échelle d'escalade : 1 responsable du service → 2 modérateur → 3 admin.
async function cibleEscalade(ticket, niveau) {
  if (niveau <= 1) {
    const dep = await prisma.department.findUnique({ where: { id: ticket.departmentId }, select: { responsibleId: true } });
    return dep?.responsibleId ? [dep.responsibleId] : await serviceMemberIds(ticket.departmentId);
  }
  if (niveau === 2) return moderateursDisponibles(ticket.sourceCompanyId);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  return admins.map((a) => a.id);
}

// Une passe : balaie les demandes actionnables (en file, non prises en main, non closes).
export async function executerScheduler(now = new Date()) {
  let rappels = 0, escalades = 0;
  const tickets = await prisma.ticket.findMany({
    where: { status: "NEW", prisEnMainA: null, escaladeA: { not: null } },
    select: {
      id: true, title: true, urgency: true, departmentId: true, sourceCompanyId: true,
      assignedToId: true, rappelA: true, escaladeA: true, niveauEscalade: true, rappelEnvoye: true,
    },
  });

  for (const t of tickets) {
    // Rappel (une seule fois) → assigné, ou responsable si non assigné.
    if (!t.rappelEnvoye && t.rappelA && now >= new Date(t.rappelA)) {
      const cible = t.assignedToId ? [t.assignedToId] : await cibleEscalade(t, 1);
      await notifier({ evenement: "rappel", destinataires: cible, demande: t });
      await prisma.ticket.update({ where: { id: t.id }, data: { rappelEnvoye: true } });
      rappels++;
    }
    // Escalade → monte d'un barreau et recalcule la prochaine échéance.
    if (t.escaladeA && now >= new Date(t.escaladeA)) {
      const max = paliersEscalade(t.urgency); // 3 pour CRITIQUE, 2 sinon
      if (t.niveauEscalade < max) {
        const niveau = t.niveauEscalade + 1;
        const cible = await cibleEscalade(t, niveau);
        await notifier({ evenement: "escalade", destinataires: cible, demande: t });
        const ech = await calculerEcheances(t.urgency, now, t.sourceCompanyId);
        await prisma.ticket.update({ where: { id: t.id }, data: { niveauEscalade: niveau, escaladeA: ech.escaladeA } });
        escalades++;
      }
    }
  }
  return { rappels, escalades, scannes: tickets.length };
}

// Démarrage périodique (appelé depuis index.js). Anti-chevauchement.
export function demarrerScheduler(intervalleMs = 5 * 60 * 1000) {
  let enCours = false;
  const run = async () => {
    if (enCours) return;
    enCours = true;
    try { await executerScheduler(); }
    catch (e) { console.error("scheduler:", e?.message || e); }
    finally { enCours = false; }
  };
  setTimeout(run, 15000);            // une première passe peu après le démarrage
  return setInterval(run, intervalleMs);
}
