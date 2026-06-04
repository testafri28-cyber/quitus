import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { authApi } from "../api/endpoints.js";

// Modale « Mon compte » — changer son propre mot de passe.
export function ChangePasswordModal({ user, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 6) return setErr("Le nouveau mot de passe doit faire au moins 6 caractères.");
    if (next !== confirm) return setErr("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      setDone(true);
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Mon compte</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{user?.name} · {user?.email}</div>
          {done ? (
            <div className="error-box" style={{ background: "color-mix(in srgb, var(--st-resolu) 12%, white)", color: "var(--st-resolu)", border: "1px solid color-mix(in srgb, var(--st-resolu) 30%, white)" }}>
              ✓ Mot de passe modifié.
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div className="section-label" style={{ margin: 0 }}>Changer mon mot de passe</div>
              {err && <div className="error-box">{err}</div>}
              <input className="input" type="password" placeholder="Mot de passe actuel" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              <input className="input" type="password" placeholder="Nouveau mot de passe (6 caractères min.)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
              <input className="input" type="password" placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={busy}>{busy ? "Modification…" : "Changer le mot de passe"}</button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
