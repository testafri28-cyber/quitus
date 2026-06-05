import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import {
  superadminApi, INVOICE_STATUS_META, METHOD_META, METHODS, INVOICE_STATUSES, fcfa, shortDate,
} from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";

function PayModal({ invoice, onClose, onDone }) {
  const [method, setMethod] = useState("WAVE");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await superadminApi.payInvoice(invoice.id, { method, transaction_ref: ref || undefined });
      onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Marquer comme payée</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <ErrorBox message={err} />
          <div className="sa-field" style={{ marginBottom: 16 }}>
            <div className="spread"><span style={{ color: "var(--text-2)" }}>{invoice.tenant?.name}</span><strong>{fcfa(invoice.amount_fcfa)}</strong></div>
          </div>
          <div className="sa-field">
            <label className="label">Moyen de paiement</label>
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m} value={m}>{METHOD_META[m]}</option>)}
            </select>
          </div>
          <div className="sa-field">
            <label className="label">Référence de transaction <span style={{ color: "var(--text-3)" }}>· optionnel</span></label>
            <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TXN-…" />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Enregistrement…" : "Confirmer le paiement"}</button>
        </form>
      </div>
    </div>
  );
}

export default function SaInvoices() {
  const [invoices, setInvoices] = useState(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [paying, setPaying] = useState(null);

  const load = useCallback(() => {
    setInvoices(null);
    superadminApi.invoices({ status }).then((d) => setInvoices(d.invoices)).catch((e) => setErr(e.message));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const cancelInvoice = async (inv) => {
    if (!window.confirm(`Annuler la facture de ${inv.tenant?.name} ?`)) return;
    try { await superadminApi.cancelInvoice(inv.id); load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="sa-page">
      <div className="sa-head">
        <div>
          <h1 className="sa-h1">Factures</h1>
          <p className="sa-sub">Suivi de la facturation de tous les clients.</p>
        </div>
      </div>

      <ErrorBox message={err} />

      <div className="sa-toolbar">
        <div className="sa-seg">
          <button className={status === "" ? "on" : ""} onClick={() => setStatus("")}>Toutes</button>
          {INVOICE_STATUSES.map((s) => (
            <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{INVOICE_STATUS_META[s].label}</button>
          ))}
        </div>
        <div className="sa-spacer" />
        {invoices && <span className="sa-count">{invoices.length} facture{invoices.length > 1 ? "s" : ""}</span>}
      </div>

      {!invoices ? <Loading /> : invoices.length === 0 ? (
        <div className="sa-card sa-empty">Aucune facture pour ce filtre.</div>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr><th>Client</th><th>Montant</th><th>Statut</th><th>Échéance</th><th>Payée le</th><th></th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link to={`/superadmin/tenants/${inv.tenant?.id}`} className="sa-link" style={{ fontWeight: 600 }}>{inv.tenant?.name}</Link>
                    {inv.notes ? <div className="sa-mono">{inv.notes}</div> : null}
                  </td>
                  <td style={{ fontWeight: 700 }}>{fcfa(inv.amount_fcfa)}</td>
                  <td><Badge meta={INVOICE_STATUS_META[inv.status]} /></td>
                  <td>{shortDate(inv.due_date)}</td>
                  <td>{inv.paid_at ? shortDate(inv.paid_at) : "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button className="btn btn-subtle btn-sm" onClick={() => setPaying(inv)}><Icon name="check" />Marquer payée</button>
                        <button className="btn btn-ghost btn-sm" title="Annuler la facture" onClick={() => cancelInvoice(inv)}><Icon name="x" /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />}
    </div>
  );
}
