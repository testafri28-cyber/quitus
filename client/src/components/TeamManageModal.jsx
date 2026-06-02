import { useEffect, useState } from "react";
import { Icon } from "./Icon.jsx";
import { Avatar } from "./Badges.jsx";
import { departmentsApi } from "../api/endpoints.js";
import { usePresence } from "../context/PresenceContext.jsx";
import { PRESENCE_STATE_META } from "../lib/design.js";

// Gestion des membres d'un service — réservé au responsable (ou admin).
// Ajoute / retire des membres ; le serveur applique les droits.
export function TeamManageModal({ departmentId, deptName, onClose, onChanged }) {
  const [members, setMembers] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { presenceState } = usePresence();

  const load = () => {
    Promise.all([departmentsApi.members(departmentId), departmentsApi.candidates(departmentId)])
      .then(([m, c]) => { setMembers(m.members); setCandidates(c.candidates); })
      .catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [departmentId]);

  const add = async () => {
    if (!pick) return;
    setBusy(true); setErr("");
    try { await departmentsApi.addMember(departmentId, pick); setPick(""); load(); onChanged?.(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Retirer ${u.name} de « ${deptName} » ?`)) return;
    setBusy(true); setErr("");
    try { await departmentsApi.removeMember(departmentId, u.id); load(); onChanged?.(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontWeight: 700 }}>Équipe — {deptName}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Ajoutez ou retirez les membres de ce service.</div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          {err && <div className="error-box" style={{ marginBottom: 12 }}>{err}</div>}

          <div className="section-label">Ajouter un membre</div>
          <div className="row" style={{ gap: 8, marginBottom: 18 }}>
            <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }} disabled={busy}>
              <option value="">— Choisir une personne —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.department ? ` (actuellement : ${c.department.name})` : ""}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={add} disabled={!pick || busy}><Icon name="plusCircle" />Ajouter</button>
          </div>

          <div className="section-label">Membres {members ? `(${members.length})` : ""}</div>
          {!members ? <div className="empty">Chargement…</div>
            : members.length === 0 ? <div className="muted" style={{ fontSize: 13.5 }}>Aucun membre rattaché à ce service.</div>
            : (
              <div style={{ display: "grid", gap: 6 }}>
                {members.map((m) => (
                  <div key={m.id} className="card card-pad spread" style={{ padding: "8px 12px" }}>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={m.name} size={30} />
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="pres-dot" style={{ background: PRESENCE_STATE_META[presenceState(m.id)].color }} />
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</span>
                          <span className="muted" style={{ fontSize: 11.5 }}>· {PRESENCE_STATE_META[presenceState(m.id)].label}</span>
                        </div>
                        {m.email && <div className="muted" style={{ fontSize: 12 }}>{m.email}</div>}
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(m)} disabled={busy}>Retirer</button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
