// Glue entre les enums de l'API (MAJUSCULES) et le langage visuel Quitus (classes CSS minuscules).

export const TYPE_META = {
  INTERVENTION: { cls: "intervention", label: "Intervention", icon: "wrench", desc: "Action corrective — quelque chose ne fonctionne pas et doit être réparé." },
  NEED: { cls: "besoin", label: "Besoin particulier", icon: "clipboard", desc: "Demande de prestation ou de ressource à planifier." },
};
export const TYPES = ["INTERVENTION", "NEED"];

export const URGENCY_META = {
  NORMAL: { cls: "normale", label: "Normale", hint: "Traitement dans le flux normal." },
  HIGH: { cls: "haute", label: "Haute", hint: "Traitement prioritaire sous 24 h." },
  URGENT: { cls: "urgente", label: "Urgente", hint: "À traiter immédiatement — notifie le responsable du service." },
};
export const URGENCIES = ["NORMAL", "HIGH", "URGENT"];

export const STATUS_META = {
  NEW: { cls: "nouveau", label: "Nouveau" },
  IN_PROGRESS: { cls: "encours", label: "En cours" },
  ON_HOLD: { cls: "attente", label: "En attente" },
  RESOLVED: { cls: "resolu", label: "Résolu" },
  CLOSED: { cls: "cloture", label: "Clôturé" },
};
export const STATUS_ORDER = ["NEW", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];

// Transition « action principale » côté agent.
export const NEXT_STATUS = { NEW: "IN_PROGRESS", IN_PROGRESS: "RESOLVED", ON_HOLD: "IN_PROGRESS", RESOLVED: "CLOSED", CLOSED: null };
export const NEXT_LABEL = { NEW: "Prendre la main", IN_PROGRESS: "Marquer résolu", ON_HOLD: "Reprendre", RESOLVED: "Clôturer", CLOSED: null };

export const SPACE_META = {
  global: { key: "global", name: "Espace Global", sub: "Demandes cross-entreprises", mono: "GL", color: "#6e62b6" },
  wca: { key: "wca", name: "West Coast Atlantic", sub: "Portail interne", mono: "WCA", color: "#378add" },
  idc: { key: "idc", name: "Ivoirienne d'Hydrocarbures", sub: "Portail interne", mono: "IDC", color: "#ef9f27" },
  admin: { key: "admin", name: "Administration", sub: "Gestion complète", mono: "AD", color: "#5e6b7d" },
};
export const SPACE_API = { global: "GLOBAL", wca: "WCA", idc: "IDC", admin: "GLOBAL" };

// Icône par code de service (Department.code).
export const SERVICE_ICONS = {
  it: "monitor", design: "palette", rh: "users", juridique: "scale", finance: "calculator", direction: "landmark",
  "wca-daf": "wallet", "wca-expl-hcl": "droplets", "wca-expl-marchandises": "package", "wca-qhse": "shield",
  "wca-obc": "gauge", "wca-log-parc": "truck", "wca-maintenance": "settings",
  "idc-controle-gestion": "chart", "idc-tresorerie": "store", "idc-tpe": "card", "idc-reseau": "network",
  "idc-dev-reseau": "map", "idc-stock": "boxes", "idc-commercial": "bag", "idc-marketing": "megaphone",
};
export const serviceIcon = (code) => SERVICE_ICONS[code] || "grid";

// Groupe (Commun / WCA / IDC) d'un service selon l'entreprise rattachée.
export function groupOf(department) {
  if (!department || !department.company) return "Commun";
  return department.company.slug === "wca" ? "WCA" : department.company.slug === "idc" ? "IDC" : "Commun";
}
export const GROUPS = ["Commun", "WCA", "IDC"];
export const GROUP_META = {
  Commun: { label: "Groupe Commun", sub: "Accessible à tous", color: "#6e62b6", mono: "CO" },
  WCA: { label: "Groupe WCA", sub: "West Coast Atlantic", color: "#378add", mono: "WCA" },
  IDC: { label: "Groupe IDC", sub: "Ivoirienne d'Hydrocarbures", color: "#ef9f27", mono: "IDC" },
};

// Avatar : initiales + couleur stable dérivée du nom.
const AVATAR_COLORS = ["#378add", "#ef9f27", "#6e62b6", "#4f9d77", "#c66150", "#5e6b7d", "#5b8def"];
export function initials(name) {
  return (name || "?").split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}
export function avatarColor(name) {
  let h = 0;
  for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const ROLE_LABELS = { MEMBER: "Membre", ADMIN: "Administrateur" };

// Texte lisible (blanc/sombre) sur un aplat de couleur hex.
export function inkOn(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#3c2c08" : "#fff";
}

export const LEAVE_KINDS = {
  paye: "Congé payé",
  maladie: "Congé maladie",
  "sans-solde": "Sans solde",
  autre: "Autre",
};
export const LEAVE_KEYS = ["paye", "maladie", "sans-solde", "autre"];

/* ---------- Alertes : demandes à surveiller ---------- */
const HOUR_MS = 3600 * 1000;
export const ALERT_THRESHOLDS = { staleUnassignedH: 24, slowH: 72 };
export const ALERT_META = {
  urgent: { label: "Urgentes", short: "Urgent", icon: "flame", color: "#c66150", desc: "À traiter en priorité" },
  stale: { label: "En attente d'assignation", short: "À assigner", icon: "clock", color: "#c9933a", desc: "Anciennes, sans personne dessus" },
  slow: { label: "Traitement qui traîne", short: "En retard", icon: "alertTriangle", color: "#d97a3c", desc: "En cours depuis trop longtemps" },
};
export const ALERT_ORDER = ["urgent", "stale", "slow"];

// Renvoie les alertes actives d'un ticket (selon l'ancienneté et le statut).
export function ticketAlerts(t) {
  const out = [];
  const open = t.status !== "RESOLVED" && t.status !== "CLOSED";
  const ageH = (Date.now() - new Date(t.createdAt).getTime()) / HOUR_MS;
  if (open && t.urgency === "URGENT") out.push("urgent");
  if (t.status === "NEW" && !t.assignee && ageH > ALERT_THRESHOLDS.staleUnassignedH) out.push("stale");
  if ((t.status === "IN_PROGRESS" || t.status === "ON_HOLD") && ageH > ALERT_THRESHOLDS.slowH) out.push("slow");
  return out;
}

/* ---------- Audit / journal d'événements ---------- */
export const EVENT_META = {
  created: { icon: "plus", label: "Création", accent: true },
  status: { icon: "refresh", label: "Statut" },
  assigned: { icon: "user", label: "Assignation", accent: true },
  unassigned: { icon: "user", label: "Désassignation" },
  reassigned: { icon: "send", label: "Réaffectation" },
  transfer_proposed: { icon: "send", label: "Transfert proposé" },
  transfer_accepted: { icon: "check", label: "Transfert accepté", accent: true },
  transfer_refused: { icon: "x", label: "Transfert refusé" },
  transfer_cancelled: { icon: "x", label: "Transfert annulé" },
  comment: { icon: "message", label: "Commentaire" },
  document: { icon: "paperclip", label: "Document" },
  feedback: { icon: "star", label: "Avis" },
};
export const EVENT_ACTIONS = Object.keys(EVENT_META);

export function eventSentence(action, detailRaw) {
  let d = {};
  try { d = detailRaw ? (typeof detailRaw === "string" ? JSON.parse(detailRaw) : detailRaw) : {}; } catch { d = {}; }
  switch (action) {
    case "created": return "a créé la demande";
    case "status": return `a changé le statut : ${STATUS_META[d.from]?.label || d.from || "?"} → ${STATUS_META[d.to]?.label || d.to || "?"}`;
    case "assigned": return d.self ? "a pris la main" : `a assigné à ${d.assignee || "un membre"}`;
    case "unassigned": return "a retiré l'assignation";
    case "reassigned": return `a réaffecté le service : ${d.from || "?"} → ${d.to || "?"}`;
    case "transfer_proposed": return `a proposé un transfert à ${d.to || "un collègue"}`;
    case "transfer_accepted": return "a accepté le transfert";
    case "transfer_refused": return "a refusé le transfert";
    case "transfer_cancelled": return "a annulé le transfert";
    case "comment": return d.internal ? "a ajouté un commentaire interne" : "a commenté";
    case "document": return `a déposé un document${d.name ? ` (${d.name})` : ""}`;
    case "feedback": return `a laissé un avis${d.rating ? ` (${d.rating}/5)` : ""}`;
    default: return action;
  }
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const mois = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  return `${d.getDate()} ${mois[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
