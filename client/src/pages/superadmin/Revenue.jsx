import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi, PLAN_META, fcfa } from "../../api/superadmin.js";
import { Loading, ErrorBox } from "./ui.jsx";

const compact = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "k";
  return String(n);
};

export default function SaRevenue() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    superadminApi.revenue().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!data) return <div className="sa-page"><Loading /></div>;

  const maxPlan = Math.max(1, ...data.byPlan.map((b) => b.amount));

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Revenus</h1>
          <p className="sa-sub">Performance financière du SaaS Quitus.</p>
        </div>
      </div>

      <div className="sa-kpis">
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="sliders" />MRR</div>
          <div className="sa-k-val sm">{fcfa(data.mrr)}</div>
          <div className="sa-k-hint">revenu récurrent (abonnements actifs)</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="refresh" />ARR</div>
          <div className="sa-k-val sm">{fcfa(data.arr)}</div>
          <div className="sa-k-hint">annualisé (MRR × 12)</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="x" />Churn du mois</div>
          <div className="sa-k-val">{data.churnThisMonth}<span style={{ fontSize: 15, color: "var(--text-3)", fontWeight: 600 }}> · {data.churnRate}%</span></div>
          <div className="sa-k-hint">clients partis ce mois</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="check" />Encaissé ce mois</div>
          <div className="sa-k-val sm">{fcfa(data.collectedThisMonth)}</div>
          <div className="sa-k-hint">paiements réellement reçus</div>
        </div>
      </div>

      <div className="sa-grid-2" style={{ alignItems: "start" }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Paiements des 6 derniers mois</h2>
          <div className="sa-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.payments6months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} width={42} />
                <Tooltip
                  formatter={(v) => [fcfa(v), "Paiements"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }}
                  cursor={{ fill: "var(--accent-softer)" }}
                />
                <Bar dataKey="total" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">MRR par plan</h2>
          {data.byPlan.every((b) => b.amount === 0) ? (
            <div className="sa-empty" style={{ padding: "30px 0" }}>Aucun abonnement actif.</div>
          ) : (
            data.byPlan.map((b) => {
              const meta = PLAN_META[b.plan];
              return (
                <div key={b.plan} style={{ marginBottom: 14 }}>
                  <div className="spread" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{meta.label}</span>
                    <span style={{ fontWeight: 700 }}>{fcfa(b.amount)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(b.amount / maxPlan) * 100}%`, background: meta.color, borderRadius: 6, transition: "width .3s" }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
