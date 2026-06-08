import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { TypeChip, UrgencyPill, EmitterBadge } from "../components/Badges.jsx";
import { ticketsApi, departmentsApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate, serviceIcon } from "../lib/design.js";

export default function TriBox() {
  const { space } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [choix, setChoix] = useState({}); // ticketId -> departmentId
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    ticketsApi.aTrier().then(({ tickets }) => setTickets(tickets)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch(() => {});
  }, [load]);

  const orienter = async (t) => {
    setBusy(t.id); setError("");
    try {
      await ticketsApi.trier(t.id, choix[t.id] || t.department?.id);
      showToast("Demande orientée.");
      load();
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="scroll"><div className="page">
      <div className="page-head">
        <h1 className="page-title">Boîte de tri</h1>
        <p className="page-sub">Demandes sans destination claire — confirmez le service ou redirigez.</p>
      </div>
      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {!tickets ? <div className="empty">Chargement…</div> : tickets.length === 0 ? (
        <div className="empty"><Icon name="check" /><div>Rien à trier — tout est orienté. ✓</div></div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {tickets.map((t) => (
            <div className="card card-pad" key={t.id}>
              <div className="spread" style={{ alignItems: "flex-start", gap: 14 }}>
                <div className="row" style={{ gap: 13, minWidth: 0, alignItems: "flex-start" }}>
                  <TypeChip type={t.type} />
                  <div style={{ minWidth: 0 }}>
                    <button className="link-name" style={{ fontWeight: 600, fontSize: 15 }} onClick={() => navigate(`/${space}/tickets/${t.id}`)}>{t.title}</button>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{t.reference} · {formatDate(t.createdAt)}</div>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}><UrgencyPill urgency={t.urgency} /><EmitterBadge company={t.sourceCompany} /></div>
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: 13 }}>Orienter vers</span>
                <select className="select" style={{ maxWidth: 280 }} value={choix[t.id] || t.department?.id || ""} onChange={(e) => setChoix((c) => ({ ...c, [t.id]: e.target.value }))}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : " (commun)"}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={busy === t.id} onClick={() => orienter(t)}>
                  <Icon name="send" />{busy === t.id ? "…" : "Confirmer la destination"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
}
