import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi, BUCKET_META, SEVERITY_META, fcfa } from "../../api/superadmin.js";
import { Loading, ErrorBox } from "./ui.jsx";

const fmtUptime = (s) => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
};
const fmtBytes = (b) => (b < 1024 ? `${b} o` : b < 1048576 ? `${Math.round(b / 1024)} Ko` : `${(b / 1048576).toFixed(1)} Mo`);

function StateDot({ ok }) {
  return <span className="sa-dot" style={{ background: ok ? "#1D9E75" : "#97a1b0", width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />;
}

export default function SaCockpit() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { superadminApi.cockpit().then(setData).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!data) return <div className="sa-page"><Loading /></div>;

  const k = data.kpis;
  const sh = data.systemHealth;

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Cockpit</h1>
          <p className="sa-sub">Ce sur quoi agir aujourd'hui — argent, risque et santé technique au même endroit.</p>
        </div>
        <Link to="/superadmin/revenue" className="btn btn-subtle"><Icon name="sliders" />Revenus détaillés</Link>
      </div>

      <div className="sa-kpis">
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="sliders" />MRR</div>
          <div className="sa-k-val sm">{fcfa(k.mrr)}</div>
          <div className="sa-k-hint">revenu récurrent (abonnements actifs)</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="refresh" />Rétention nette</div>
          <div className="sa-k-val">{k.netRetention}%</div>
          <div className="sa-k-hint">comptes conservés</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="alertTriangle" />Comptes à risque</div>
          <div className="sa-k-val">{k.atRiskCount}</div>
          <div className="sa-k-hint">santé &lt; 40/100</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="file" />En retard</div>
          <div className="sa-k-val sm">{fcfa(k.overdueTotal)}</div>
          <div className="sa-k-hint">{k.overdueCount} facture(s) impayée(s)</div>
        </div>
      </div>

      <div className="sa-grid-2" style={{ alignItems: "start" }}>
        {/* File d'attention */}
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">File d'attention</h2>
          {data.attentionQueue.length === 0 ? (
            <div className="sa-empty" style={{ padding: "26px 0" }}>Rien à traiter — tout est sous contrôle. ✓</div>
          ) : data.attentionQueue.map((it, i) => (
            <button key={i} className="sa-queue-item" onClick={() => it.targetId && navigate(`/superadmin/comptes/${it.targetId}`)}>
              <span className="sa-sev" style={{ background: SEVERITY_META[it.severity]?.color }} />
              <span className="sa-queue-body">
                <span className="sa-queue-label">{it.label}</span>
                <span className="sa-queue-detail">{it.detail}</span>
              </span>
              <Icon name="arrowRight" style={{ width: 16, height: 16, color: "var(--text-3)" }} />
            </button>
          ))}
        </div>

        {/* Santé système + watchlist */}
        <div style={{ display: "grid", gap: 18 }}>
          <div className="sa-card sa-card-pad">
            <h2 className="sa-card-h">Santé système</h2>
            <div className="sa-sys">
              <div className="sa-sys-row"><span>Disponibilité (processus)</span><b>{fmtUptime(sh.uptimeSeconds)}</b></div>
              <div className="sa-sys-row"><span>Connexions temps réel</span><b>{sh.socketConnections}</b></div>
              <div className="sa-sys-row"><span>E-mail (Resend)</span><b><StateDot ok={sh.email.state === "actif"} /> {sh.email.state === "actif" ? "Actif" : "Désactivé"}</b></div>
              <div className="sa-sys-row"><span>Notifications push</span><b><StateDot ok={sh.webPush.state === "actif"} /> {sh.webPush.state === "actif" ? "Actif" : "Désactivé"}</b></div>
              <div className="sa-sys-row"><span>Stockage ({sh.storage.mode})</span><b>{sh.storage.files} fichiers · {fmtBytes(sh.storage.bytes)}</b></div>
              <div className="sa-sys-row"><span>File de jobs</span><b><StateDot ok={sh.jobs.state === "actif"} /> {sh.jobs.pending} en attente</b></div>
            </div>
          </div>

          <div className="sa-card sa-card-pad">
            <h2 className="sa-card-h">Comptes à surveiller</h2>
            {data.watchlist.map((w) => {
              const m = BUCKET_META[w.bucket];
              return (
                <Link key={w.id} to={`/superadmin/comptes/${w.id}`} className="sa-watch">
                  <span className="sa-watch-score" style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 40%, white)` }}>{w.score}</span>
                  <span className="sa-watch-body">
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{w.name}</span>
                    <span className="sa-watch-sub" style={{ color: m.color }}>{m.label}</span>
                  </span>
                  <Icon name="arrowRight" style={{ width: 15, height: 15, color: "var(--text-3)" }} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
