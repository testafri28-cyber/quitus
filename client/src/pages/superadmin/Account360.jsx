import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import {
  superadminApi, startImpersonation, PLAN_META, TENANT_STATUS_META, INVOICE_STATUS_META,
  METHOD_META, CYCLE_META, BUCKET_META, AUDIT_LABEL, PLANS, TENANT_STATUSES, fcfa, shortDate,
} from "../../api/superadmin.js";
import { Badge, Loading, ErrorBox } from "./ui.jsx";
import { InvoiceModal } from "./TenantDetail.jsx";

// Anneau de score (SVG) coloré selon le bucket.
function ScoreRing({ score, color }) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 46 46)" />
      <text x="46" y="50" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{score}</text>
      <text x="46" y="64" textAnchor="middle" fontSize="9" fill="var(--text-3)">/ 100</text>
    </svg>
  );
}

function CompBar({ label, value }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div className="spread" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{label}</span>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: "var(--qa-brand-interactive)", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function diagnosisLine(h) {
  const low = [["usage", h.usage], ["engagement", h.engagement], ["support", h.support], ["facturation", h.billing]]
    .filter(([, v]) => v < 60).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  if (!low.length) return "Compte sain sur toutes les dimensions.";
  return `Point(s) faible(s) : ${low.join(", ")}.`;
}

function ImpersonateButton({ accountId, impersonation }) {
  const [busy, setBusy] = useState(false);
  if (!impersonation?.available) {
    return <button className="btn btn-subtle" disabled title="Compte non relié à un utilisateur frontoffice"><Icon name="logout" />Consulter en tant que</button>;
  }
  const go = async () => {
    if (!window.confirm(`Ouvrir le frontoffice en tant que ${impersonation.user.email} ? Cette session est tracée.`)) return;
    setBusy(true);
    try {
      const { token } = await superadminApi.impersonate(accountId);
      startImpersonation(token);            // pose le jeton frontoffice (clé ticket_token)
      window.open("/", "_blank");           // ouvre le frontoffice (nouvel onglet) → bannière de consultation
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return <button className="btn btn-subtle" onClick={go} disabled={busy}><Icon name="logout" />{busy ? "Ouverture…" : "Consulter en tant que"}</button>;
}

export default function SaAccount360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [invModal, setInvModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "" });

  const load = useCallback(() => { superadminApi.account(id).then(setD).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); }, [load]);

  const update = async (patch) => {
    setSaving(true); setErr("");
    try { await superadminApi.updateTenant(id, patch); load(); } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const startEdit = () => { setForm({ name: d.tenant.name, contact_email: d.tenant.contact_email, contact_phone: d.tenant.contact_phone || "" }); setEditing(true); };
  const saveContact = async () => {
    setSaving(true); setErr("");
    try { await superadminApi.updateTenant(id, { name: form.name.trim(), contact_email: form.contact_email.trim(), contact_phone: form.contact_phone.trim() || null }); setEditing(false); load(); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const cancelInvoice = async (inv) => {
    if (!window.confirm(`Annuler la facture de ${fcfa(inv.amount_fcfa)} ?`)) return;
    try { await superadminApi.cancelInvoice(inv.id); load(); } catch (e) { setErr(e.message); }
  };

  if (err && !d) return <div className="sa-page"><ErrorBox message={err} /></div>;
  if (!d) return <div className="sa-page"><Loading /></div>;

  const { tenant, health, usage, timeline, impersonation } = d;
  const m = BUCKET_META[health.bucket];
  const totalPaid = tenant.payments.reduce((s, p) => s + p.amount_fcfa, 0);

  return (
    <div className="sa-page">
      <button className="sa-back" onClick={() => navigate("/superadmin/comptes")}><Icon name="arrowLeft" />Retour aux comptes</button>

      <div className="sa-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ maxWidth: 420 }}>
              <input className="input" style={{ marginBottom: 8 }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom" />
              <input className="input" style={{ marginBottom: 8 }} type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="E-mail" />
              <input className="input" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} placeholder="Téléphone" />
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={saveContact} disabled={saving}>Enregistrer</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="sa-h1">{tenant.name}</h1>
              <p className="sa-sub">{tenant.contact_email}{tenant.contact_phone ? ` · ${tenant.contact_phone}` : ""} · <button className="sa-link" style={{ font: "inherit" }} onClick={startEdit}>Modifier</button></p>
            </>
          )}
        </div>
        {!editing && (
          <div className="row" style={{ gap: 8 }}>
            <ImpersonateButton accountId={id} impersonation={impersonation} />
            <button className="btn btn-primary" onClick={() => setInvModal(true)}><Icon name="file" />Générer une facture</button>
          </div>
        )}
      </div>

      <ErrorBox message={err} />

      {/* Santé + abonnement */}
      <div className="sa-grid-2" style={{ marginBottom: 22, alignItems: "start" }}>
        <div className="sa-card sa-card-pad">
          <h2 className="sa-card-h">Score de santé</h2>
          <div className="row" style={{ gap: 18, alignItems: "center", marginBottom: 12 }}>
            <ScoreRing score={health.score} color={m.color} />
            <div>
              <Badge meta={m} />
              <div className="muted" style={{ fontSize: 12.5, marginTop: 8, maxWidth: 220, lineHeight: 1.45 }}>{diagnosisLine(health)}</div>
            </div>
          </div>
          <CompBar label="Usage" value={health.usage} />
          <CompBar label="Engagement" value={health.engagement} />
          <CompBar label="Support" value={health.support} />
          <CompBar label="Facturation" value={health.billing} />
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="sa-card sa-card-pad">
            <h2 className="sa-card-h">Abonnement</h2>
            <div className="sa-field">
              <label className="label">Plan</label>
              <select className="select" value={tenant.plan} disabled={saving} onChange={(e) => update({ plan: e.target.value })}>
                {PLANS.map((p) => <option key={p} value={p}>{PLAN_META[p].label}</option>)}
              </select>
            </div>
            <div className="sa-field">
              <label className="label">Statut</label>
              <select className="select" value={tenant.status} disabled={saving} onChange={(e) => update({ status: e.target.value })}>
                {TENANT_STATUSES.map((s) => <option key={s} value={s}>{TENANT_STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div className="hint" style={{ fontSize: 12.5, color: "var(--text-3)" }}>Facturation {CYCLE_META[tenant.billing_cycle]} · total encaissé <strong>{fcfa(totalPaid)}</strong></div>
          </div>

          <div className="sa-card sa-card-pad">
            <h2 className="sa-card-h">Usage</h2>
            <div className="sa-meta">
              <div className="sa-cell"><div className="sa-k">Tickets (30 j)</div><div className="sa-v">{usage.tickets30d}</div></div>
              <div className="sa-cell"><div className="sa-k">Moyenne (90 j)</div><div className="sa-v">{usage.tickets90dAvg}</div></div>
              <div className="sa-cell"><div className="sa-k">Dernière activité</div><div className="sa-v">{usage.lastActivityAt ? shortDate(usage.lastActivityAt) : "—"}</div></div>
              <div className="sa-cell"><div className="sa-k">Escalades</div><div className="sa-v">{usage.openEscalations}{usage.escalationsOver24h ? ` (${usage.escalationsOver24h} >24h)` : ""}</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Facturation */}
      <div className="sa-card" style={{ marginBottom: 22 }}>
        <div className="sa-card-pad" style={{ paddingBottom: 0 }}><h2 className="sa-card-h">Factures</h2></div>
        {tenant.invoices.length === 0 ? <div className="sa-empty">Aucune facture.</div> : (
          <div className="sa-table-wrap" style={{ border: "none", boxShadow: "none" }}>
            <table className="sa-table">
              <thead><tr><th>Montant</th><th>Statut</th><th>Échéance</th><th>Payée le</th><th></th></tr></thead>
              <tbody>
                {tenant.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700 }}>{fcfa(inv.amount_fcfa)}</td>
                    <td><Badge meta={INVOICE_STATUS_META[inv.status]} /></td>
                    <td>{shortDate(inv.due_date)}</td>
                    <td>{inv.paid_at ? shortDate(inv.paid_at) : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <button className="btn btn-ghost btn-sm" title="Annuler" onClick={() => cancelInvoice(inv)}><Icon name="x" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline d'activité (audit) */}
      <div className="sa-card sa-card-pad">
        <h2 className="sa-card-h">Activité du compte</h2>
        {timeline.length === 0 ? <div className="sa-empty" style={{ padding: "20px 0" }}>Aucune action enregistrée.</div> : timeline.map((a) => (
          <div key={a.id} className="spread" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
            <div><span style={{ fontWeight: 600, fontSize: 13.5 }}>{AUDIT_LABEL[a.action] || a.action}</span><span className="muted" style={{ fontSize: 13 }}> — {a.detail}</span></div>
            <span className="sa-mono" style={{ whiteSpace: "nowrap" }}>{shortDate(a.created_at)}</span>
          </div>
        ))}
      </div>

      {invModal && <InvoiceModal tenant={tenant} onClose={() => setInvModal(false)} onDone={() => { setInvModal(false); load(); }} />}
    </div>
  );
}
