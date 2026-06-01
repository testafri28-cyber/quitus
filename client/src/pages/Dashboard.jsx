import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { FilterDropdown } from "../components/Controls.jsx";
import { TypeChip, UrgencyPill, StatusChip, EmitterBadge, Avatar } from "../components/Badges.jsx";
import { ticketsApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { TYPE_META, TYPES, STATUS_META, STATUS_ORDER, URGENCY_META, URGENCIES, serviceIcon, formatDate, ticketAlerts, ALERT_META, ALERT_ORDER } from "../lib/design.js";

export default function Dashboard() {
  const { space } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user.role === "ADMIN";

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Séparation : "received" = adressées à mon service · "mine" = que j'ai soumises.
  const [view, setView] = useState(space === "global" ? "mine" : "received");
  const [alertFilter, setAlertFilter] = useState(null);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState([]);
  const [fStatus, setFStatus] = useState([]);
  const [fUrg, setFUrg] = useState([]);

  useEffect(() => {
    setLoading(true);
    ticketsApi
      .list({ pageSize: 100 })
      .then(({ tickets }) => setTickets(tickets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (arr, set) => (k) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  const mineCount = useMemo(() => tickets.filter((t) => t.submittedById === user.id).length, [tickets, user.id]);
  const receivedCount = useMemo(() => tickets.filter((t) => t.department?.id === user.departmentId).length, [tickets, user.departmentId]);

  // Liste de base selon la vue (l'admin voit tout).
  const base = useMemo(() => {
    if (isAdmin) return tickets;
    if (view === "mine") return tickets.filter((t) => t.submittedById === user.id);
    return tickets.filter((t) => t.department?.id === user.departmentId);
  }, [tickets, view, isAdmin, user.id, user.departmentId]);

  // Calcul des alertes par ticket sur la liste de base.
  const withAlerts = useMemo(() => base.map((t) => ({ t, alerts: ticketAlerts(t) })), [base]);
  const alertCounts = useMemo(() => {
    const c = { urgent: 0, stale: 0, slow: 0 };
    withAlerts.forEach(({ alerts }) => alerts.forEach((a) => { c[a]++; }));
    return c;
  }, [withAlerts]);

  const prio = (alerts) => (alerts.length ? Math.min(...alerts.map((a) => ALERT_ORDER.indexOf(a))) : 99);

  const filtered = useMemo(() => withAlerts
    .filter(({ t, alerts }) => {
      if (q && !(t.title.toLowerCase().includes(q.toLowerCase()) || t.reference.toLowerCase().includes(q.toLowerCase()))) return false;
      if (fType.length && !fType.includes(t.type)) return false;
      if (fStatus.length && !fStatus.includes(t.status)) return false;
      if (fUrg.length && !fUrg.includes(t.urgency)) return false;
      if (alertFilter && !alerts.includes(alertFilter)) return false;
      return true;
    })
    .sort((a, b) => prio(a.alerts) - prio(b.alerts) || new Date(b.t.createdAt) - new Date(a.t.createdAt))
  , [withAlerts, q, fType, fStatus, fUrg, alertFilter]);

  const title = isAdmin ? "Toutes les demandes" : view === "mine" ? "Mes demandes" : "Demandes reçues";
  const sub = isAdmin ? "Vue consolidée des deux entreprises."
    : view === "mine" ? "Demandes que vous avez soumises et leur avancement."
    : `Adressées à votre service${user.department ? " " + user.department.name : ""} — à traiter par l'équipe.`;

  const hasFilter = fType.length || fStatus.length || fUrg.length || q || alertFilter;

  return (
    <div className="scroll">
      <div className="page">
        <div className="page-head spread">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-sub">{sub}</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate(`/${space}/form`)}><Icon name="plus" />Nouvelle demande</button>
        </div>

        {!isAdmin && (
          <div className="seg" style={{ marginBottom: 16 }}>
            <button type="button" className={view === "received" ? "sel" : ""} onClick={() => setView("received")}>
              <Icon name="inbox" style={{ width: 16, height: 16 }} />Reçues
              <span className="nav-badge" style={{ marginLeft: 2 }}>{receivedCount}</span>
            </button>
            <button type="button" className={view === "mine" ? "sel" : ""} onClick={() => setView("mine")}>
              <Icon name="send" style={{ width: 16, height: 16 }} />Mes demandes
              <span className="nav-badge" style={{ marginLeft: 2 }}>{mineCount}</span>
            </button>
          </div>
        )}

        {(alertCounts.urgent + alertCounts.stale + alertCounts.slow) > 0 && (
          <div className="alert-bar">
            <span className="ab-label"><Icon name="alertTriangle" />À surveiller</span>
            {ALERT_ORDER.map((key) => {
              const m = ALERT_META[key];
              const n = alertCounts[key];
              if (n === 0) return null;
              return (
                <button key={key} type="button"
                  className={"alert-pill" + (alertFilter === key ? " active" : "")}
                  style={{ "--ac": m.color }}
                  onClick={() => setAlertFilter(alertFilter === key ? null : key)}>
                  <Icon name={m.icon} /><span className="ap-n">{n}</span>{m.label}
                </button>
              );
            })}
            {alertFilter && (
              <button type="button" className="btn btn-subtle btn-sm" onClick={() => setAlertFilter(null)}>Tout voir</button>
            )}
          </div>
        )}

        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder="Rechercher un titre ou un n° de ticket…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <FilterDropdown label="Type" icon="sliders" selected={fType} onToggle={toggle(fType, setFType)}
            options={TYPES.map((t) => ({ key: t, render: () => (<span className="row" style={{ gap: 8 }}><Icon name={TYPE_META[t].icon} style={{ width: 15, height: 15 }} />{TYPE_META[t].label}</span>) }))} />
          <FilterDropdown label="Statut" icon="refresh" selected={fStatus} onToggle={toggle(fStatus, setFStatus)}
            options={STATUS_ORDER.map((s) => ({ key: s, render: () => (<span className={"stat " + STATUS_META[s].cls} style={{ border: "none", background: "none", padding: 0 }}><span className="s-dot" />{STATUS_META[s].label}</span>) }))} />
          <FilterDropdown label="Urgence" icon="filter" selected={fUrg} onToggle={toggle(fUrg, setFUrg)}
            options={URGENCIES.map((u) => ({ key: u, label: URGENCY_META[u].label }))} />
          {hasFilter ? (
            <button className="btn btn-subtle btn-sm" onClick={() => { setFType([]); setFStatus([]); setFUrg([]); setQ(""); setAlertFilter(null); }}>Réinitialiser</button>
          ) : null}
          <div style={{ marginLeft: "auto", fontSize: 13.5, color: "var(--text-3)", fontWeight: 500 }}>
            {filtered.length} demande{filtered.length > 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="empty">Chargement…</div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : (
          <div className="tickets">
            <div className="t-head">
              <span>Type</span><span>Demande</span><span>Service</span><span>Urgence</span><span>Statut</span><span>Assigné</span><span>Émetteur · Date</span>
            </div>
            {filtered.length === 0 ? (
              <div className="empty"><Icon name="inbox" /><div>Aucune demande ne correspond à ces filtres.</div></div>
            ) : filtered.map(({ t }) => (
                <button key={t.id} className={"t-row" + (t.urgency === "URGENT" ? " urgent" : "")} onClick={() => navigate(`/${space}/tickets/${t.id}`)}>
                  <TypeChip type={t.type} />
                  <div className="t-titlewrap">
                    <div className="t-title" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{t.title}</span>
                      {t.transferTo?.id === user.id && (
                        <span className="alert-chips" style={{ flexShrink: 0 }}>
                          <span className="alert-chip" style={{ background: "#6e62b6" }}><Icon name="send" />À accepter</span>
                        </span>
                      )}
                      {t.suggestedTo?.id === user.id && t.assignedToId !== user.id && t.status !== "RESOLVED" && t.status !== "CLOSED" && (
                        <span className="alert-chips" style={{ flexShrink: 0 }}>
                          <span className="alert-chip" style={{ background: "#5b8def" }}><Icon name="user" />Pour vous</span>
                        </span>
                      )}
                    </div>
                    <div className="t-id mono">{t.reference}</div>
                  </div>
                  <div className="t-svc">
                    <span className="ts-ico"><Icon name={serviceIcon(t.department?.code)} /></span>
                    <span className="ts-name">{t.department?.name}</span>
                  </div>
                  <UrgencyPill urgency={t.urgency} />
                  <StatusChip status={t.status} />
                  <div className="t-assignee">
                    {t.assignee
                      ? <span className="row" style={{ gap: 7, minWidth: 0 }}><Avatar name={t.assignee.name} size={24} /><span className="ts-name">{t.assignee.name}</span></span>
                      : <span className="unassigned">Non assigné</span>}
                  </div>
                  <div>
                    <EmitterBadge company={t.sourceCompany} />
                    <div className="t-date" style={{ marginTop: 4 }}>{formatDate(t.createdAt)}</div>
                  </div>
                </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
