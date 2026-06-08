import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { TypeChip, UrgencyPill, EmitterBadge, Avatar } from "../components/Badges.jsx";
import { ticketsApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { formatDate } from "../lib/design.js";

export default function Validation() {
  const { space } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    ticketsApi.aValider().then(({ tickets }) => setTickets(tickets)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const decider = async (t, accept) => {
    let motif;
    if (!accept) {
      motif = window.prompt("Motif du refus (transmis au demandeur) :", "");
      if (motif === null) return; // annulé
    }
    setBusy(t.id); setError("");
    try {
      await ticketsApi.valider(t.id, accept, motif || undefined);
      showToast(accept ? "Besoin validé — il entre en file." : "Besoin refusé.");
      load();
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="scroll"><div className="page">
      <div className="page-head">
        <h1 className="page-title">À valider</h1>
        <p className="page-sub">Besoins en attente de votre feu vert avant d'entrer en file.</p>
      </div>
      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {!tickets ? <div className="empty">Chargement…</div> : tickets.length === 0 ? (
        <div className="empty"><Icon name="check" /><div>Aucun besoin en attente de validation. ✓</div></div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {tickets.map((t) => (
            <div className="card card-pad" key={t.id}>
              <div className="row" style={{ gap: 13, minWidth: 0, alignItems: "flex-start" }}>
                <TypeChip type={t.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button className="link-name" style={{ fontWeight: 600, fontSize: 15 }} onClick={() => navigate(`/${space}/tickets/${t.id}`)}>{t.title}</button>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{t.reference} · {t.department?.name} · {formatDate(t.createdAt)}</div>
                  <div className="desc-body" style={{ fontSize: 13.5, marginTop: 8, color: "var(--text-2)" }}>{t.description}</div>
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <UrgencyPill urgency={t.urgency} /><EmitterBadge company={t.sourceCompany} />
                    {t.submitter && <span className="row" style={{ gap: 6 }}><Avatar name={t.submitter.name} size={22} /><span className="muted" style={{ fontSize: 12.5 }}>{t.submitter.name}</span></span>}
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === t.id} onClick={() => decider(t, true)}><Icon name="check" />Feu vert</button>
                <button className="btn btn-danger btn-sm" disabled={busy === t.id} onClick={() => decider(t, false)}><Icon name="x" />Refuser</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
}
