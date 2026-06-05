// Score de santé client (backoffice éditeur). Fonction PURE et testable.
// Le tenant n'étant pas relié au frontoffice, les signaux d'usage/engagement/support
// proviennent de champs alimentés (seed/intégration) ; la facturation est dérivée des factures.

// Poids (somme = 1) et seuils — constantes faciles à régler.
export const WEIGHTS = { usage: 0.35, engagement: 0.30, support: 0.15, billing: 0.20 };
export const BUCKET_THRESHOLDS = { healthy: 70, watch: 40 }; // >=70 SAIN · 40–69 A_SURVEILLER · <40 A_RISQUE

// Score de facturation par statut.
export const BILLING_SCORE = { up_to_date: 100, pending: 70, overdue: 30, suspended: 0 };

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n);

export function bucketFor(score) {
  if (score >= BUCKET_THRESHOLDS.healthy) return "SAIN";
  if (score >= BUCKET_THRESHOLDS.watch) return "A_SURVEILLER";
  return "A_RISQUE";
}

/**
 * @param {object} signals
 *  - tickets30d, tickets90dAvg : volume d'activité (usage)
 *  - daysSinceLastActivity : ancienneté de la dernière connexion (engagement)
 *  - openEscalations, escalationsOver24h : support
 *  - billingStatus : "up_to_date" | "pending" | "overdue" | "suspended"
 * @returns {{score, bucket, usage, engagement, support, billing}}
 */
export function computeHealth(signals = {}) {
  const {
    tickets30d = 0,
    tickets90dAvg = 0,
    daysSinceLastActivity = 999,
    openEscalations = 0,
    escalationsOver24h = 0,
    billingStatus = "up_to_date",
  } = signals;

  // Usage : activité du mois rapportée à la moyenne glissante (100 = au niveau habituel).
  const ratio = tickets30d / Math.max(1, tickets90dAvg);
  const usage = clamp(round(ratio * 100));

  // Engagement : pénalise l'inactivité au-delà de 2 jours (−6 pts/jour).
  const engagement = clamp(100 - Math.max(0, daysSinceLastActivity - 2) * 6);

  // Support : pénalise les escalades ouvertes, davantage celles de plus de 24 h.
  const support = clamp(100 - 12 * openEscalations - 10 * escalationsOver24h);

  // Facturation.
  const billing = BILLING_SCORE[billingStatus] ?? BILLING_SCORE.up_to_date;

  const score = round(
    WEIGHTS.usage * usage +
    WEIGHTS.engagement * engagement +
    WEIGHTS.support * support +
    WEIGHTS.billing * billing
  );

  return { score, bucket: bucketFor(score), usage, engagement, support, billing };
}
