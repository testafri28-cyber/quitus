import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { Avatar } from "./Badges.jsx";
import { auditApi } from "../api/endpoints.js";
import { EVENT_META, eventSentence, formatDate } from "../lib/design.js";

// Historique des actions d'un membre (réservé admin — s'appuie sur /api/audit).
// `space` détermine la route d'ouverture des tickets (défaut admin).
export function UserHistoryModal({ user, space = "admin", onClose }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    auditApi.list({ actorId: user.id, pageSize: 100 }).then((d) => setEvents(d.events)).catch((e) => setErr(e.message));
  }, [user.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="row" style={{ gap: 11 }}>
            <Avatar name={user.name} size={38} />
            <div>
              <div style={{ fontWeight: 700 }}>{user.name}</div>
              {user.email && <div className="muted" style={{ fontSize: 12.5 }}>{user.email}</div>}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="section-label">Historique des actions {events ? `(${events.length})` : ""}</div>
          {err ? <div className="error-box">{err}</div>
            : !events ? <div className="empty">Chargement…</div>
            : events.length === 0 ? <div className="muted" style={{ fontSize: 13.5 }}>Aucune action enregistrée pour ce membre.</div>
            : (
              <div className="timeline">
                {events.map((e) => {
                  const m = EVENT_META[e.action] || {};
                  return (
                    <div className="tl-item" key={e.id}>
                      <span className={"tl-dot" + (m.accent ? " accent" : "")}><Icon name={m.icon || "clock"} /></span>
                      <div className="tl-body">
                        <div className="tl-text">
                          {eventSentence(e.action, e.detail)}{" "}
                          {e.ticket && <button className="link-mono" onClick={() => navigate(`/${space}/tickets/${e.ticket.id}`)}>{e.ticket.reference}</button>}
                        </div>
                        <div className="tl-time">{formatDate(e.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
