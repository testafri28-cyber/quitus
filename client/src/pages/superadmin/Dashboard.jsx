import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { superadminApi, PLAN_META, AUDIT_LABEL, fcfa, shortDate } from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";

const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
const relTime = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
};

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
          <div className="sa-k-label"><Icon name="sliders" />MRR</div>
          <div className="sa-k-val sm">{fcfa(data.mrr)}</div>
          <div className="sa-k-hint">abonnements actifs · {fcfa(data.collectedThisMonth)} encaissés ce mois</div>
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

      {data.recentAudit?.length > 0 && (
        <div className="sa-card sa-card-pad" style={{ marginTop: 18 }}>
          <h2 className="sa-card-h">Activité récente du backoffice</h2>
          {data.recentAudit.map((a) => (
            <div key={a.id} className="spread" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{AUDIT_LABEL[a.action] || a.action}</span>
                <span className="muted" style={{ fontSize: 13 }}> — {a.detail}</span>
              </div>
              <span className="sa-mono" style={{ whiteSpace: "nowrap" }}>{relTime(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
