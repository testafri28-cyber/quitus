import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { notificationsApi } from "../api/endpoints.js";
import { pushSupported, subscribePush, unsubscribePush } from "../lib/push.js";

function PrefRow({ icon, title, desc, on, onToggle, disabled }) {
  return (
    <div className="spread" style={{ alignItems: "flex-start" }}>
      <div className="row" style={{ gap: 11, alignItems: "flex-start" }}>
        <span className="svc-ico"><Icon name={icon} /></span>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2, maxWidth: 320, lineHeight: 1.45 }}>{desc}</div>
        </div>
      </div>
      <button type="button" className={"toggle" + (on ? " on" : "")} onClick={onToggle} disabled={disabled} role="switch" aria-checked={on} aria-label={title}>
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export function NotificationPrefsModal({ onClose }) {
  const [prefs, setPrefs] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    notificationsApi.getPreferences().then(({ preferences }) => setPrefs(preferences)).catch((e) => setErr(e.message));
  }, []);

  const toggleEmail = async () => {
    const v = !prefs.notifyEmail;
    setPrefs((p) => ({ ...p, notifyEmail: v }));
    setErr("");
    try { await notificationsApi.updatePreferences({ notifyEmail: v }); }
    catch (e) { setErr(e.message); setPrefs((p) => ({ ...p, notifyEmail: !v })); }
  };

  const togglePush = async () => {
    const v = !prefs.notifyPush;
    setErr("");
    setBusy(true);
    try {
      if (v) await subscribePush(); else await unsubscribePush();
      await notificationsApi.updatePreferences({ notifyPush: v });
      setPrefs((p) => ({ ...p, notifyPush: v }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Préférences de notification</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ display: "grid", gap: 18 }}>
          {err && <div className="error-box">{err}</div>}
          {!prefs ? <div className="empty">Chargement…</div> : (
            <>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Choisissez comment être prévenu, même sans être sur le site.</p>
              <PrefRow icon="message" title="E-mail" desc="Recevez un e-mail à chaque notification."
                on={prefs.notifyEmail} onToggle={toggleEmail} />
              <PrefRow icon="bell" title="Notifications navigateur"
                desc={supported ? "Pop-ups système, même quand l'onglet n'est pas ouvert (selon le navigateur)." : "Non pris en charge par ce navigateur."}
                on={prefs.notifyPush} onToggle={togglePush} disabled={busy || !supported} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
