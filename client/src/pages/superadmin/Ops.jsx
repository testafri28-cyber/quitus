import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi } from "../../api/superadmin.js";
import { Loading, ErrorBox } from "./ui.jsx";

const fmtUptime = (s) => { if (s < 60) return `${s}s`; const m = Math.floor(s / 60); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); return h < 48 ? `${h} h` : `${Math.floor(h / 24)} j`; };
const fmtBytes = (b) => (b < 1024 ? `${b} o` : b < 1048576 ? `${Math.round(b / 1024)} Ko` : `${(b / 1048576).toFixed(1)} Mo`);

function ServiceRow({ label, ok, value, neutral }) {
  return (
    <div className="sa-svc-row">
      <span className="sa-svc-dot" style={{ background: neutral ? "#97a1b0" : ok ? "#1D9E75" : "#c66150" }} />
      <span className="sa-svc-label">{label}</span>
      <span className="sa-svc-val">{value}</span>
    </div>
  );
}

export default function SaOps() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { superadminApi.ops().then(setData).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!data) return <div className="sa-page"><Loading /></div>;
  const s = data.system;
  const integrationsActive = [s.email.state === "actif", s.webPush.state === "actif"].filter(Boolean).length;

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Santé & exploitation</h1>
          <p className="sa-sub">Disponibilité, intégrations et escalades support.</p>
        </div>
      </div>

      <div className="sa-kpis">
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="refresh" />Disponibilité</div><div className="sa-k-val">{fmtUptime(s.uptimeSeconds)}</div><div className="sa-k-hint">depuis le démarrage</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="message" />Temps réel</div><div className="sa-k-val">{s.socketConnections}</div><div className="sa-k-hint">connexions Socket.IO</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="paperclip" />Stockage</div><div className="sa-k-val sm">{s.storage.files} fichiers</div><div className="sa-k-hint">{fmtBytes(s.storage.bytes)} · {s.storage.mode}</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="check" />Intégrations</div><div className="sa-k-val">{integrationsActive}/2</div><div className="sa-k-hint">e-mail · push</div></div>
      </div>

      <div className="sa-grid-2" style={{ alignItems: "start" }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">État des services</h2>
          <ServiceRow label="API & WebSocket" ok value="En ligne" />
          <ServiceRow label="E-mail (Resend)" ok={s.email.state === "actif"} neutral={s.email.state !== "actif"} value={s.email.state === "actif" ? "Actif" : "Désactivé (clé absente)"} />
          <ServiceRow label="Notifications push (VAPID)" ok={s.webPush.state === "actif"} neutral={s.webPush.state !== "actif"} value={s.webPush.state === "actif" ? "Actif" : "Désactivé"} />
          <ServiceRow label="Stockage des fichiers" ok value={`${s.storage.mode} · ${s.storage.files} fichiers`} />
          <ServiceRow label="File de jobs" neutral value={`${s.jobs.pending} en attente`} />
        </div>

        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Escalades support ouvertes</h2>
          {data.escalations.length === 0 ? <div className="sa-empty" style={{ padding: "26px 0" }}>Aucune escalade ouverte. ✓</div> :
            data.escalations.map((e) => (
              <div key={e.id} className="spread" style={{ padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="sa-svc-dot" style={{ background: e.over24h > 0 ? "#c66150" : "#c9933a" }} />
                  <Link to={`/superadmin/comptes/${e.id}`} className="sa-link" style={{ fontWeight: 600 }}>{e.name}</Link>
                </div>
                <span className="sa-mono">{e.open} ouverte(s){e.over24h > 0 ? ` · ${e.over24h} > 24 h` : ""}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
