import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import {
  superadminApi, PLAN_META, TENANT_STATUS_META, INVOICE_STATUS_META, METHOD_META, CYCLE_META,
  PLANS, TENANT_STATUSES, fcfa, shortDate,
} from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";

function InvoiceModal({ tenant, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return setErr("Montant invalide.");
    if (!due) return setErr("Date d'échéance requise.");
    setBusy(true);
    try {
      await superadminApi.createInvoice(tenant.id, { amount_fcfa: amt, due_date: new Date(due).toISOString(), notes: notes || undefined });
      onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Générer une facture</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <ErrorBox message={err} />
          <div className="sa-field">
            <label className="label">Montant (FCFA)</label>
            <input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150000" required />
          </div>
          <div className="sa-field">
            <label className="label">Date d'échéance</label>
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
          </div>
          <div className="sa-field">
            <label className="label">Note <span style={{ color: "var(--text-3)" }}>· optionnel</span></label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Abonnement…" />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Génération…" : "Générer la facture"}</button>
        </form>
      </div>
    </div>
  );
}

export default function SaTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [err, setErr] = useState("");
  const [invModal, setInvModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    superadminApi.tenant(id).then((d) => setTenant(d.tenant)).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const update = async (patch) => {
    setSaving(true); setErr("");
    try { await superadminApi.updateTenant(id, patch); load(); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  if (err && !tenant) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!tenant) return <div className="sa-page"><Loading /></div>;

  const totalPaid = tenant.payments.reduce((s, p) => s + p.amount_fcfa, 0);

  return (
    <div className="sa-page">
      <button className="sa-back" onClick={() => navigate("/superadmin/tenants")}><Icon name="arrowLeft" />Retour aux clients</button>

      <div className="sa-head">
        <div>
          <h1 className="sa-h1">{tenant.name}</h1>
          <p className="sa-sub">{tenant.contact_email}{tenant.contact_phone ? ` · ${tenant.contact_phone}` : ""}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setInvModal(true)}><Icon name="file" />Générer une facture</button>
      </div>

      <ErrorBox message={err} />

      <div className="sa-grid-2" style={{ marginBottom: 22, alignItems: "start" }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Informations</h2>
          <div className="sa-meta">
            <div className="sa-cell"><div className="sa-k">Plan</div><div className="sa-v"><Badge meta={PLAN_META[tenant.plan]} /></div></div>
            <div className="sa-cell"><div className="sa-k">Statut</div><div className="sa-v"><Badge meta={TENANT_STATUS_META[tenant.status]} /></div></div>
            <div className="sa-cell"><div className="sa-k">Facturation</div><div className="sa-v">{CYCLE_META[tenant.billing_cycle]}</div></div>
            <div className="sa-cell"><div className="sa-k">Créé le</div><div className="sa-v">{shortDate(tenant.created_at)}</div></div>
            <div className="sa-cell"><div className="sa-k">Renouvellement</div><div className="sa-v">{tenant.next_renewal ? shortDate(tenant.next_renewal) : "—"}</div></div>
            <div className="sa-cell"><div className="sa-k">Fin d'essai</div><div className="sa-v">{tenant.trial_ends_at ? shortDate(tenant.trial_ends_at) : "—"}</div></div>
          </div>
        </div>

        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Abonnement</h2>
          <div className="sa-field">
            <label className="label">Changer le plan</label>
            <select className="select" value={tenant.plan} disabled={saving} onChange={(e) => update({ plan: e.target.value })}>
              {PLANS.map((p) => <option key={p} value={p}>{PLAN_META[p].label}</option>)}
            </select>
          </div>
          <div className="sa-field">
            <label className="label">Changer le statut</label>
            <select className="select" value={tenant.status} disabled={saving} onChange={(e) => update({ status: e.target.value })}>
              {TENANT_STATUSES.map((s) => <option key={s} value={s}>{TENANT_STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div className="hint" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            Total encaissé : <strong>{fcfa(totalPaid)}</strong> sur {tenant.payments.length} paiement(s).
          </div>
        </div>
      </div>

      <div className="sa-card" style={{ marginBottom: 22 }}>
        <div className="sa-card-pad" style={{ paddingBottom: 0 }}><h2 className="sa-card-h">Factures</h2></div>
        {tenant.invoices.length === 0 ? (
          <div className="sa-empty">Aucune facture.</div>
        ) : (
          <div className="sa-table-wrap" style={{ border: "none", boxShadow: "none" }}>
            <table className="sa-table">
              <thead><tr><th>Montant</th><th>Statut</th><th>Échéance</th><th>Payée le</th><th>Note</th></tr></thead>
              <tbody>
                {tenant.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700 }}>{fcfa(inv.amount_fcfa)}</td>
                    <td><Badge meta={INVOICE_STATUS_META[inv.status]} /></td>
                    <td>{shortDate(inv.due_date)}</td>
                    <td>{inv.paid_at ? shortDate(inv.paid_at) : "—"}</td>
                    <td className="sa-mono">{inv.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sa-card">
        <div className="sa-card-pad" style={{ paddingBottom: 0 }}><h2 className="sa-card-h">Paiements</h2></div>
        {tenant.payments.length === 0 ? (
          <div className="sa-empty">Aucun paiement.</div>
        ) : (
          <div className="sa-table-wrap" style={{ border: "none", boxShadow: "none" }}>
            <table className="sa-table">
              <thead><tr><th>Montant</th><th>Moyen</th><th>Référence</th><th>Date</th></tr></thead>
              <tbody>
                {tenant.payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{fcfa(p.amount_fcfa)}</td>
                    <td>{METHOD_META[p.method]}</td>
                    <td className="sa-mono">{p.transaction_ref || "—"}</td>
                    <td>{shortDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invModal && <InvoiceModal tenant={tenant} onClose={() => setInvModal(false)} onDone={() => { setInvModal(false); load(); }} />}
    </div>
  );
}
