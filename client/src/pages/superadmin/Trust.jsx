import { useEffect, useState, useMemo } from "react";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi, AUDIT_LABEL } from "../../api/superadmin.js";
import { Loading, ErrorBox } from "./ui.jsx";

const AUDIT_LABEL2 = { ...AUDIT_LABEL, IMPERSONATION_START: "Consultation — début", IMPERSONATION_END: "Consultation — fin" };

const relTime = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
};

const CONTROLS = [
  ["Authentification séparée", "Comptes éditeur dans une table dédiée, hors frontoffice."],
  ["Jetons à périmètre (scope)", "superadmin / frontoffice / consultation — cloisonnés."],
  ["Anti-brute-force", "Limitation des tentatives sur les connexions."],
  ["En-têtes de sécurité (Helmet)", "Protections HTTP appliquées à toute l'API."],
  ["Journal d'audit append-only", "Chaque action sensible est tracée."],
  ["Consultation-en-tant-que tracée", "Début et fin de session enregistrés."],
];

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "impersonation", label: "Consultations" },
  { key: "invoice", label: "Facturation" },
  { key: "tenant", label: "Comptes" },
];
const matchFilter = (action, f) =>
  f === "" ? true :
  f === "impersonation" ? action.startsWith("IMPERSONATION") :
  action.startsWith(f + ".");

export default function SaTrust() {
  const [entries, setEntries] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => { superadminApi.audit({ limit: 100 }).then((d) => setEntries(d.entries)).catch((e) => setErr(e.message)); }, []);

  const impersonationCount = useMemo(() => (entries || []).filter((e) => e.action === "IMPERSONATION_START").length, [entries]);
  const filtered = useMemo(() => (entries || []).filter((e) => matchFilter(e.action, filter)), [entries, filter]);

  if (err) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!entries) return <div className="sa-page"><Loading /></div>;

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Confiance & contrôle</h1>
          <p className="sa-sub">Sécurité, audit et traçabilité des actions.</p>
        </div>
      </div>

      <div className="sa-kpis">
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="lock" />Contrôles en place</div><div className="sa-k-val">{CONTROLS.length}/{CONTROLS.length}</div><div className="sa-k-hint">mesures de sécurité actives</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="logout" />Consultations</div><div className="sa-k-val">{impersonationCount}</div><div className="sa-k-hint">sessions « en tant que »</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="refresh" />Actions tracées</div><div className="sa-k-val">{entries.length}</div><div className="sa-k-hint">dernières entrées d'audit</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="clock" />Dernière action</div><div className="sa-k-val sm">{entries[0] ? relTime(entries[0].created_at) : "—"}</div><div className="sa-k-hint">{entries[0] ? (AUDIT_LABEL2[entries[0].action] || entries[0].action) : ""}</div></div>
      </div>

      <div className="sa-grid-2" style={{ alignItems: "start" }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Contrôles de sécurité</h2>
          {CONTROLS.map(([title, desc]) => (
            <div key={title} className="row" style={{ gap: 11, alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="sa-check-ok"><Icon name="check" style={{ width: 14, height: 14 }} /></span>
              <span><div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div><div className="muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>{desc}</div></span>
            </div>
          ))}
        </div>

        <div className="sa-card sa-card-pad">
          <div className="spread" style={{ marginBottom: 12 }}>
            <h2 className="sa-card-h" style={{ margin: 0 }}>Journal d'audit</h2>
          </div>
          <div className="sa-seg" style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => <button key={f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>{f.label}</button>)}
          </div>
          {filtered.length === 0 ? <div className="sa-empty" style={{ padding: "22px 0" }}>Aucune entrée.</div> :
            <div style={{ maxHeight: 460, overflowY: "auto" }}>
              {filtered.map((a) => (
                <div key={a.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="spread">
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{AUDIT_LABEL2[a.action] || a.action}</span>
                    <span className="sa-mono" style={{ whiteSpace: "nowrap" }}>{relTime(a.created_at)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 1 }}>{a.detail} <span style={{ opacity: .7 }}>· {a.admin_email}</span></div>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
}
