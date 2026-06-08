// Pendule SLA — calcul en HEURES OUVRÉES. Fonction PURE (aucune dépendance, testable).
// Tout est piloté par le calendrier (table CalendrierOuvre) et les jours fériés (JourFerie).
// Travaille en UTC : la Côte d'Ivoire est à UTC+0 (pas de DST) → "08:00" = 08:00 UTC.

const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const dateKey = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

// Plages travaillées d'un jour (en Date UTC), pause exclue.
function segmentsFor(day, cal) {
  const y = day.getUTCFullYear(), mo = day.getUTCMonth(), da = day.getUTCDate();
  const at = (min) => new Date(Date.UTC(y, mo, da, 0, 0, 0) + min * 60000);
  const deb = toMin(cal.heureDebut), fin = toMin(cal.heureFin);
  if (cal.pauseDebut && cal.pauseFin) {
    return [[at(deb), at(toMin(cal.pauseDebut))], [at(toMin(cal.pauseFin)), at(fin)]];
  }
  return [[at(deb), at(fin)]];
}

function isWorkingDay(day, cal, feriesSet) {
  const dow = day.getUTCDay();        // 0=dim … 6=sam
  const j = dow === 0 ? 7 : dow;      // 1=lun … 7=dim
  return cal.jours.includes(j) && !feriesSet.has(dateKey(day));
}

function nextDayStart(cursor, cal) {
  const y = cursor.getUTCFullYear(), mo = cursor.getUTCMonth(), da = cursor.getUTCDate();
  return new Date(Date.UTC(y, mo, da + 1, 0, 0, 0) + toMin(cal.heureDebut) * 60000);
}

function normFeries(feries) {
  return new Set((feries || []).map((f) =>
    typeof f === "string" ? f : dateKey(new Date(f.date ?? f))
  ));
}

/**
 * Ajoute `heures` heures OUVRÉES à `depart`, en sautant pause, soirées, week-ends et fériés.
 * @returns {Date} l'instant d'échéance.
 */
export function ajouterHeuresOuvrees(depart, heures, calendrier, feries = []) {
  const cal = calendrier;
  const feriesSet = normFeries(feries);
  let cursor = new Date(depart);
  let remaining = Math.round(heures * 60); // minutes
  if (remaining <= 0) return cursor;

  let guard = 0;
  while (remaining > 0 && guard++ < 200000) {
    if (!isWorkingDay(cursor, cal, feriesSet)) { cursor = nextDayStart(cursor, cal); continue; }
    const segs = segmentsFor(cursor, cal);
    for (const [s, e] of segs) {
      if (cursor >= e) continue;                 // segment déjà passé
      if (cursor < s) cursor = new Date(s);      // avant l'ouverture / pendant la pause → on saute au début du segment
      const avail = (e - cursor) / 60000;
      if (remaining <= avail) return new Date(cursor.getTime() + remaining * 60000);
      remaining -= avail; cursor = new Date(e);
    }
    cursor = nextDayStart(cursor, cal);          // journée épuisée → jour ouvré suivant
  }
  return cursor;
}

// Heures ouvrées restantes entre deux instants (pour les badges d'échéance). >0 = temps restant.
export function heuresOuvreesRestantes(maintenant, echeance, calendrier, feries = []) {
  const cal = calendrier;
  const feriesSet = normFeries(feries);
  const a = new Date(maintenant), b = new Date(echeance);
  const sign = b >= a ? 1 : -1;
  let from = sign > 0 ? a : b, to = sign > 0 ? b : a;
  let minutes = 0, cursor = new Date(from), guard = 0;
  while (cursor < to && guard++ < 200000) {
    if (!isWorkingDay(cursor, cal, feriesSet)) { cursor = nextDayStart(cursor, cal); continue; }
    let dayDone = true;
    for (const [s, e] of segmentsFor(cursor, cal)) {
      const segStart = cursor < s ? new Date(s) : cursor;
      if (segStart >= e) continue;
      const end = e <= to ? e : to;
      if (end > segStart) { minutes += (end - segStart) / 60000; cursor = new Date(end); }
      if (e > to) { dayDone = false; break; }
    }
    if (cursor < to && dayDone) cursor = nextDayStart(cursor, cal);
  }
  return sign * (minutes / 60);
}
