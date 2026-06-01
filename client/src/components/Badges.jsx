import { Icon } from "./Icon.jsx";
import {
  TYPE_META,
  URGENCY_META,
  STATUS_META,
  serviceIcon,
  initials,
  avatarColor,
  inkOn,
} from "../lib/design.js";

// urgence — valeur API (NORMAL/HIGH/URGENT)
export function UrgencyPill({ urgency }) {
  const m = URGENCY_META[urgency];
  if (!m) return null;
  return <span className={"urg " + m.cls}><span className="u-dot" />{m.label}</span>;
}

// statut — valeur API (NEW/…)
export function StatusChip({ status }) {
  const m = STATUS_META[status];
  if (!m) return null;
  return <span className={"stat " + m.cls}><span className="s-dot" />{m.label}</span>;
}

// type — valeur API (INTERVENTION/NEED)
export function TypeChip({ type }) {
  const m = TYPE_META[type];
  if (!m) return null;
  return <span className={"type-chip " + m.cls}><Icon name={m.icon} /></span>;
}

// entreprise émettrice — company {slug, name}
// Compact par défaut (initiales + couleur). `withName` pour la version étiquetée.
export function EmitterBadge({ company, withName }) {
  if (!company) return null;
  const color = company.color || "#64748b";
  if (withName) {
    return (
      <span className="emit">
        <span className="e-mono" style={{ background: color, color: inkOn(color) }}>{company.slug.toUpperCase()}</span>
        <span className="e-name">{company.name}</span>
      </span>
    );
  }
  return (
    <span className="emit-mini" style={{ background: color, color: inkOn(color) }} title={company.name}>
      {company.slug.toUpperCase()}
    </span>
  );
}

export function Avatar({ name, size = 30 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

// icône d'un service (department {code})
export function ServiceIcon({ department, accent }) {
  return (
    <span className={"svc-ico" + (accent ? " accent" : "")}>
      <Icon name={serviceIcon(department?.code)} />
    </span>
  );
}
