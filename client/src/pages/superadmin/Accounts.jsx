import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import {
  superadminApi, PLAN_META, TENANT_STATUS_META, BUCKET_META, PLANS, TENANT_STATUSES, shortDate,
} from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";
import { NewTenantModal } from "./Tenants.jsx";

const BUCKETS = [
  { key: "SAIN", label: "Sain" },
  { key: "A_SURVEILLER", label: "À surveiller" },
  { key: "A_RISQUE", label: "À risque" },
];

function ScorePill({ health }) {
  const m = BUCKET_META[health.bucket];
  return (
    <span className="sa-score-pill" style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 40%, white)`, background: `color-mix(in srgb, ${m.color} 9%, white)` }}>
      <b>{health.score}</b><span style={{ opacity: .8 }}>/100</span>
    </span>
  );
}

export default function SaAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [bucket, setBucket] = useState("");
  const [modal, setModal] = useState(false);

  const load = useCallback(() => {
    setAccounts(null);
    superadminApi.accounts({ status, plan, bucket }).then((d) => setAccounts(d.accounts)).catch((e) => setErr(e.message));
  }, [status, plan, bucket]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Comptes</h1>
          <p className="sa-sub">Les entreprises clientes, classées par santé.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" />Nouveau client</button>
      </div>

      <ErrorBox message={err} />

      <div className="sa-toolbar">
        <div className="sa-seg">
          <button className={bucket === "" ? "on" : ""} onClick={() => setBucket("")}>Toute santé</button>
          {BUCKETS.map((b) => <button key={b.key} className={bucket === b.key ? "on" : ""} onClick={() => setBucket(b.key)}>{b.label}</button>)}
        </div>
        <div className="sa-seg">
          <button className={status === "" ? "on" : ""} onClick={() => setStatus("")}>Tous statuts</button>
          {TENANT_STATUSES.map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{TENANT_STATUS_META[s].label}</button>)}
        </div>
        <div className="sa-seg">
          <button className={plan === "" ? "on" : ""} onClick={() => setPlan("")}>Tous plans</button>
          {PLANS.map((p) => <button key={p} className={plan === p ? "on" : ""} onClick={() => setPlan(p)}>{PLAN_META[p].label}</button>)}
        </div>
        <div className="sa-spacer" />
        {accounts && <span className="sa-count">{accounts.length} compte{accounts.length > 1 ? "s" : ""}</span>}
      </div>

      {!accounts ? <Loading /> : accounts.length === 0 ? (
        <div className="sa-card sa-empty">Aucun compte pour ces filtres.</div>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr><th>Santé</th><th>Compte</th><th>Plan</th><th>Statut</th><th>Créé le</th><th>Renouvellement</th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => navigate(`/superadmin/comptes/${a.id}`)}>
                  <td><ScorePill health={a.health} /></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="sa-mono">{a.contact_email}</div>
                  </td>
                  <td><Badge meta={PLAN_META[a.plan]} /></td>
                  <td><Badge meta={TENANT_STATUS_META[a.status]} /></td>
                  <td>{shortDate(a.created_at)}</td>
                  <td>{a.next_renewal ? shortDate(a.next_renewal) : a.trial_ends_at ? `Essai → ${shortDate(a.trial_ends_at)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <NewTenantModal onClose={() => setModal(false)} onCreated={(tn) => { setModal(false); navigate(`/superadmin/comptes/${tn.id}`); }} />}
    </div>
  );
}
