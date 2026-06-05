import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi, PLAN_META, fcfa, shortDate } from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";

const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

export default function SaDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    superadminApi.stats().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!data) return <div className="sa-page"><Loading /></div>;

  const t = data.tenants;

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Tableau de bord</h1>
          <p className="sa-sub">Vue d'ensemble de l'activité SaaS de Quitus.</p>
        </div>
      </div>

      <div className="sa-kpis">
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="check" />Clients actifs</div>
          <div className="sa-k-val">{t.active}</div>
          <div className="sa-k-hint">{t.total} clients au total</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="clock" />En essai</div>
          <div className="sa-k-val">{t.trial}</div>
          <div className="sa-k-hint">{data.trialEndingSoon.length} expire(nt) sous 7 j</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="x" />Clients partis</div>
          <div className="sa-k-val">{t.churned}</div>
          <div className="sa-k-hint">{t.suspended} suspendu(s)</div>
        </div>
        <div className="sa-kpi">
          <div className="sa-k-label"><Icon name="sliders" />MRR du mois</div>
          <div className="sa-k-val sm">{fcfa(data.mrr)}</div>
          <div className="sa-k-hint">paiements encaissés ce mois</div>
        </div>
      </div>

      <div className="sa-grid-2">
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Essais expirant bientôt</h2>
          {data.trialEndingSoon.length === 0 ? (
            <div className="sa-empty" style={{ padding: "22px 0" }}>Aucun essai n'expire dans les 7 jours.</div>
          ) : (
            data.trialEndingSoon.map((tn) => (
              <div key={tn.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <Link to={`/superadmin/tenants/${tn.id}`} className="sa-link" style={{ fontWeight: 600 }}>{tn.name}</Link>
                  <div className="sa-mono">{tn.contact_email}</div>
                </div>
                <Badge meta={{ label: `J-${daysLeft(tn.trial_ends_at)}`, color: "#c9933a" }} />
              </div>
            ))
          )}
        </div>

        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Derniers paiements reçus</h2>
          {data.recentPayments.length === 0 ? (
            <div className="sa-empty" style={{ padding: "22px 0" }}>Aucun paiement enregistré.</div>
          ) : (
            data.recentPayments.map((p) => (
              <div key={p.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.tenant?.name}</div>
                  <div className="sa-mono">{shortDate(p.paid_at)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge meta={PLAN_META[p.tenant?.plan]} />
                  <span style={{ fontWeight: 700 }}>{fcfa(p.amount_fcfa)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
