import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { Avatar } from "./Badges.jsx";
import { authApi } from "../api/endpoints.js";
import { usePresence } from "../context/PresenceContext.jsx";
import { ROLE_LABELS, PRESENCE_OPTIONS, PRESENCE_STATE_META } from "../lib/design.js";

const memberSince = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—";

// Modale « Mon compte » — profil (lecture seule), disponibilité et mot de passe.
export function ChangePasswordModal({ user, onClose }) {
  const { myPresence, setMyPresence, presenceState } = usePresence();

  // Mot de passe
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const roleLabel = user?.role === "ADMIN" ? ROLE_LABELS.ADMIN : ROLE_LABELS.MEMBER;

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

  const presMeta = PRESENCE_STATE_META[presenceState(user?.id)] || PRESENCE_STATE_META.offline;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Mon compte</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ display: "grid", gap: 20 }}>
          {/* En-tête de profil */}
          <div className="row" style={{ gap: 13 }}>
            <Avatar name={user?.name} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
              <div className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
            </div>
          </div>

          {/* Récapitulatif (lecture seule) */}
          <div className="acct-grid">
            <div className="acct-cell"><div className="ac-k">Rôle</div><div className="ac-v">{roleLabel}</div></div>
            <div className="acct-cell"><div className="ac-k">Service</div><div className="ac-v">{user?.department?.name || "—"}</div></div>
            <div className="acct-cell"><div className="ac-k">Entreprise</div><div className="ac-v">{user?.company?.name || "—"}</div></div>
            <div className="acct-cell"><div className="ac-k">Membre depuis</div><div className="ac-v">{memberSince(user?.createdAt)}</div></div>
          </div>

          {/* Disponibilité */}
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Ma disponibilité</div>
            <div className="row" style={{ gap: 10 }}>
              <span className="pres-dot" style={{ background: presMeta.color }} title={presMeta.label} />
              <select className="select" style={{ flex: 1 }} value={myPresence} onChange={(e) => setMyPresence(e.target.value)}>
                {PRESENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="hint">Visible par vos collègues dans la discussion et l'annuaire.</div>
          </div>

          {/* Mot de passe */}
          <div>
            <div className="divider" style={{ margin: "0 0 16px" }} />
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
      </div>
    </div>,
    document.body
  );
}
