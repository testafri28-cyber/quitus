import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { chatApi } from "../api/endpoints.js";

// Création d'un salon par l'admin : un canal global, ou le salon d'un service (parmi ceux sans salon).
export function CreateRoomModal({ roomlessDepts, onClose, onCreated }) {
  const [choice, setChoice] = useState("__global__"); // "__global__" ou un departmentId
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isGlobal = choice === "__global__";

  const create = async () => {
    setErr(""); setBusy(true);
    try {
      const payload = isGlobal
        ? { scope: "GLOBAL", name: name.trim() }
        : { departmentId: choice, name: name.trim() || undefined };
      const { room } = await chatApi.createRoom(payload);
      onCreated(room);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const canSubmit = isGlobal ? !!name.trim() : true;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <div style={{ fontWeight: 700 }}>Créer un salon</div>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          {err && <div className="error-box" style={{ marginBottom: 12 }}>{err}</div>}

          <div className="section-label">Type de salon</div>
          <select className="select" value={choice} onChange={(e) => setChoice(e.target.value)} disabled={busy} style={{ marginBottom: 16 }}>
            <option value="__global__">Canal global (ouvert à tous)</option>
            {roomlessDepts.length > 0 && <option disabled>──────────</option>}
            {roomlessDepts.map((d) => (
              <option key={d.id} value={d.id}>Salon du service · {d.name}{d.company ? ` (${d.company.name})` : " (commun)"}</option>
            ))}
          </select>

          <div className="section-label">Nom du salon {isGlobal ? "" : <span className="muted">· optionnel</span>}</div>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isGlobal ? "Ex. Annonces, Direction…" : "Par défaut : le nom du service"}
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) create(); }}
          />

          <div className="spread" style={{ marginTop: 20 }}>
            <button className="btn btn-subtle" onClick={onClose} disabled={busy}>Annuler</button>
            <button className="btn btn-primary" onClick={create} disabled={!canSubmit || busy}>
              <Icon name="plusCircle" />{busy ? "Création…" : "Créer le salon"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
