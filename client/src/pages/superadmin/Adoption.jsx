import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi, PLAN_META, shortDate } from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";

const daysLeft = (iso) => (iso ? Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000)) : null);

export default function SaAdoption() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { superadminApi.adoption().then(setData).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!data) return <div className="sa-page"><Loading /></div>;
  const k = data.kpis;
  const maxPlan = Math.max(1, ...data.planDistribution.map((p) => p.count));

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Adoption</h1>
          <p className="sa-sub">Activation, usage et expansion des comptes.</p>
        </div>
      </div>

      <div className="sa-kpis">
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="refresh" />Conversion</div><div className="sa-k-val">{k.conversionRate}%</div><div className="sa-k-hint">actifs / (actifs + partis)</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="check" />Actifs (7 j)</div><div className="sa-k-val">{k.activeLast7d}</div><div className="sa-k-hint">comptes avec activité récente</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="inbox" />Usage moyen</div><div className="sa-k-val">{k.avgUsage}</div><div className="sa-k-hint">tickets / 30 j (comptes actifs)</div></div>
        <div className="sa-kpi"><div className="sa-k-label"><Icon name="sliders" />Expansion</div><div className="sa-k-val">{k.upsellCount}</div><div className="sa-k-hint">opportunités d'upsell</div></div>
      </div>

      <div className="sa-grid-2" style={{ alignItems: "start" }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Essais à convertir</h2>
          {data.trialsToConvert.length === 0 ? <div className="sa-empty" style={{ padding: "22px 0" }}>Aucun essai en cours.</div> :
            data.trialsToConvert.map((t) => (
              <div key={t.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div><Link to={`/superadmin/comptes/${t.id}`} className="sa-link" style={{ fontWeight: 600 }}>{t.name}</Link>
                  <div className="sa-mono">{t.tickets_30d} tickets / 30 j</div></div>
                <div className="row" style={{ gap: 10 }}><Badge meta={PLAN_META[t.plan]} /><Badge meta={{ label: `J-${daysLeft(t.trial_ends_at) ?? "?"}`, color: "#c9933a" }} /></div>
              </div>
            ))}
        </div>

        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Opportunités d'expansion</h2>
          {data.expansion.length === 0 ? <div className="sa-empty" style={{ padding: "22px 0" }}>Aucune opportunité détectée.</div> :
            data.expansion.map((t) => (
              <div key={t.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div><Link to={`/superadmin/comptes/${t.id}`} className="sa-link" style={{ fontWeight: 600 }}>{t.name}</Link>
                  <div className="sa-mono">{t.tickets_30d} tickets / 30 j — usage élevé</div></div>
                <div className="row" style={{ gap: 6, fontSize: 12.5 }}>
                  <Badge meta={PLAN_META[t.plan]} /><Icon name="arrowRight" style={{ width: 14, height: 14, color: "var(--text-3)" }} /><Badge meta={PLAN_META[t.suggestedPlan]} />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="sa-grid-2" style={{ alignItems: "start", marginTop: 18 }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Comptes dormants</h2>
          {data.dormant.length === 0 ? <div className="sa-empty" style={{ padding: "22px 0" }}>Aucun compte dormant. ✓</div> :
            data.dormant.map((t) => (
              <div key={t.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div><Link to={`/superadmin/comptes/${t.id}`} className="sa-link" style={{ fontWeight: 600 }}>{t.name}</Link>
                  <div className="sa-mono">{t.tickets_30d} tickets / 30 j</div></div>
                <span className="sa-mono">{t.lastActivityAt ? `vu ${shortDate(t.lastActivityAt)}` : "jamais"}</span>
              </div>
            ))}
        </div>

        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Répartition par plan</h2>
          {data.planDistribution.map((p) => {
            const m = PLAN_META[p.plan];
            return (
              <div key={p.plan} style={{ marginBottom: 13 }}>
                <div className="spread" style={{ marginBottom: 5 }}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.label}</span><span style={{ fontWeight: 700 }}>{p.count}</span></div>
                <div style={{ height: 8, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(p.count / maxPlan) * 100}%`, background: m.color, borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
