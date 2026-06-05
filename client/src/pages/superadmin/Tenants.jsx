import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import {
  superadminApi, PLAN_META, TENANT_STATUS_META, PLANS, TENANT_STATUSES, shortDate,
} from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";

function NewTenantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "", plan: "STARTER", status: "TRIAL", billing_cycle: "MONTHLY" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { tenant } = await superadminApi.createTenant(form);
      onCreated(tenant);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Nouveau client</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <ErrorBox message={err} />
          <div className="sa-field">
            <label className="label">Nom du client</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Ex. Groupe ABC" required />
          </div>
          <div className="sa-field">
            <label className="label">E-mail de contact</label>
            <input className="input" type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="dsi@client.ci" required />
          </div>
          <div className="sa-field">
            <label className="label">Téléphone <span style={{ color: "var(--text-3)" }}>· optionnel</span></label>
            <input className="input" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+225 …" />
          </div>
          <div className="sa-grid-2">
            <div className="sa-field">
              <label className="label">Plan</label>
              <select className="select" value={form.plan} onChange={set("plan")}>
                {PLANS.map((p) => <option key={p} value={p}>{PLAN_META[p].label}</option>)}
              </select>
            </div>
            <div className="sa-field">
              <label className="label">Statut</label>
              <select className="select" value={form.status} onChange={set("status")}>
                {TENANT_STATUSES.map((s) => <option key={s} value={s}>{TENANT_STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          <div className="sa-field">
            <label className="label">Cycle de facturation</label>
            <select className="select" value={form.billing_cycle} onChange={set("billing_cycle")}>
              <option value="MONTHLY">Mensuel</option>
              <option value="QUARTERLY">Trimestriel</option>
              <option value="ANNUAL">Annuel</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
            {busy ? "Création…" : "Créer le client"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SaTenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [modal, setModal] = useState(false);

  const load = useCallback(() => {
    setTenants(null);
    superadminApi.tenants({ status, plan }).then((d) => setTenants(d.tenants)).catch((e) => setErr(e.message));
  }, [status, plan]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Clients</h1>
          <p className="sa-sub">Les organisations abonnées à Quitus.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" />Nouveau client</button>
      </div>

      <ErrorBox message={err} />

      <div className="sa-toolbar">
        <div className="sa-seg">
          <button className={status === "" ? "on" : ""} onClick={() => setStatus("")}>Tous statuts</button>
          {TENANT_STATUSES.map((s) => (
            <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{TENANT_STATUS_META[s].label}</button>
          ))}
        </div>
        <div className="sa-seg">
          <button className={plan === "" ? "on" : ""} onClick={() => setPlan("")}>Tous plans</button>
          {PLANS.map((p) => (
            <button key={p} className={plan === p ? "on" : ""} onClick={() => setPlan(p)}>{PLAN_META[p].label}</button>
          ))}
        </div>
        <div className="sa-spacer" />
        {tenants && <span className="sa-count">{tenants.length} client{tenants.length > 1 ? "s" : ""}</span>}
      </div>

      {!tenants ? <Loading /> : tenants.length === 0 ? (
        <div className="sa-card sa-empty">Aucun client pour ces filtres.</div>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr><th>Client</th><th>Plan</th><th>Statut</th><th>Créé le</th><th>Prochain renouvellement</th><th>Factures</th></tr>
            </thead>
            <tbody>
              {tenants.map((tn) => (
                <tr key={tn.id} className="clickable" onClick={() => navigate(`/superadmin/tenants/${tn.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tn.name}</div>
                    <div className="sa-mono">{tn.contact_email}</div>
                  </td>
                  <td><Badge meta={PLAN_META[tn.plan]} /></td>
                  <td><Badge meta={TENANT_STATUS_META[tn.status]} /></td>
                  <td>{shortDate(tn.created_at)}</td>
                  <td>{tn.next_renewal ? shortDate(tn.next_renewal) : tn.trial_ends_at ? `Essai → ${shortDate(tn.trial_ends_at)}` : "—"}</td>
                  <td className="sa-mono">{tn._count?.invoices ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <NewTenantModal onClose={() => setModal(false)} onCreated={(tn) => { setModal(false); navigate(`/superadmin/tenants/${tn.id}`); }} />}
    </div>
  );
}
