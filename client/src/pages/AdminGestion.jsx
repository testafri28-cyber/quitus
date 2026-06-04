import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { departmentsApi, usersApi, settingsApi, auditApi } from "../api/endpoints.js";
import { downloadFile } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useBrand } from "../context/BrandContext.jsx";
import { applyBrand } from "../lib/brand.js";
import { EmitterBadge } from "../components/Badges.jsx";
import { UserHistoryModal } from "../components/UserHistoryModal.jsx";
import { STATUS_ORDER, STATUS_META, ROLE_LABELS, formatDate, inkOn, EVENT_META, EVENT_ACTIONS, eventSentence } from "../lib/design.js";

export default function AdminGestion() {
  const [tab, setTab] = useState("stats");
  return (
    <div className="scroll">
      <div className="page">
        <div className="page-head">
          <h1 className="page-title">Gestion</h1>
          <p className="page-sub">Indicateurs consolidés, utilisateurs et services des deux entreprises.</p>
        </div>
        <div className="tabs">
          {[["stats", "Indicateurs"], ["perf", "Performance"], ["audit", "Audit"], ["users", "Utilisateurs"], ["depts", "Services & entreprises"], ["brand", "Apparence"], ["params", "Paramètres"]].map(([k, l]) => (
            <button key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === "stats" && <Stats />}
        {tab === "perf" && <Performance />}
        {tab === "audit" && <Audit />}
        {tab === "users" && <Users />}
        {tab === "depts" && <Depts />}
        {tab === "brand" && <Brand />}
        {tab === "params" && <Params />}
      </div>
    </div>
  );
}

function Stats() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { departmentsApi.stats().then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error-box">{err}</div>;
  if (!s) return <div className="empty">Chargement…</div>;
  const companyById = Object.fromEntries(s.perCompany.map((c) => [c.id, c]));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="stat-strip">
        <div className="kpi"><div className="k-val">{s.total}</div><div className="k-label">Volume total</div></div>
        <div className="kpi"><div className="k-val">{s.avgRating != null ? `${s.avgRating}/5` : "—"}</div><div className="k-label">Satisfaction ({s.feedbackCount} avis)</div></div>
        {s.perType && <div className="kpi"><div className="k-val">{s.perType.INTERVENTION}</div><div className="k-label">Interventions</div></div>}
        {s.perType && <div className="kpi"><div className="k-val">{s.perType.NEED}</div><div className="k-label">Besoins</div></div>}
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        {s.perCompany.map((c) => (
          <div className="kpi" key={c.id}>
            <div className="spread"><span className="k-label">Tickets émis</span><EmitterBadge company={c} /></div>
            <div className="k-val" style={{ color: c.color, marginTop: 4 }}>{c.total}</div>
          </div>
        ))}
      </div>

      <table className="data-table">
        <thead><tr><th>Service</th><th>Entreprise</th><th>Total</th>{STATUS_ORDER.map((st) => <th key={st}>{STATUS_META[st].label}</th>)}<th title="Hors temps passé en attente">Délai actif (h)</th></tr></thead>
        <tbody>
          {s.perDepartment.map((d) => (
            <tr key={d.id}>
              <td style={{ fontWeight: 600 }}>{d.name}</td>
              <td>{d.companyId ? <EmitterBadge company={companyById[d.companyId]} /> : <span className="muted">commun</span>}</td>
              <td>{d.total}</td>
              {STATUS_ORDER.map((st) => <td key={st} className="muted">{d.counts[st] || 0}</td>)}
              <td className="muted">{d.avgResolutionHours != null ? d.avgResolutionHours : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Performance() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [hist, setHist] = useState(null);
  useEffect(() => { usersApi.stats().then(({ perUser }) => setRows(perUser)).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error-box">{err}</div>;

  const eligible = rows.filter((r) => r.resolvedCount > 0 && r.avgInterventionHours != null);
  const best = eligible.length ? eligible.reduce((a, b) => (b.avgInterventionHours < a.avgInterventionHours ? b : a)) : null;
  const sorted = [...rows].sort((a, b) => b.interventions - a.interventions || ((a.avgInterventionHours ?? 1e9) - (b.avgInterventionHours ?? 1e9)));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {best && (
        <div className="kpi">
          <span className="k-label">⭐ Membre le plus efficace</span>
          <div className="k-val" style={{ marginTop: 4 }}>{best.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>{best.resolvedCount} intervention{best.resolvedCount > 1 ? "s" : ""} résolue{best.resolvedCount > 1 ? "s" : ""} · délai moyen {best.avgInterventionHours} h</div>
        </div>
      )}
      <table className="data-table">
        <thead><tr><th>Membre</th><th>Service</th><th>Demandes</th><th>Pris en main</th><th>Interventions</th><th>Résolues</th><th title="Hors temps passé en attente">Délai actif (h)</th></tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td><button className="row-link" onClick={() => setHist(r)} title="Voir l'historique des actions">{r.name}</button>{best && r.id === best.id && <span title="Plus efficace"> ⭐</span>}</td>
              <td className="muted">{r.department?.name || "—"}</td>
              <td>{r.submitted}</td>
              <td style={{ fontWeight: 600 }}>{r.taken}</td>
              <td>{r.interventions}</td>
              <td className="muted">{r.resolvedCount}</td>
              <td className="muted">{r.avgInterventionHours != null ? r.avgInterventionHours : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12.5 }}>Le délai actif mesure le temps entre la création d'une demande et sa résolution, <strong>hors temps passé « En attente »</strong> (ex. en attente d'un besoin lié) — pour les demandes prises en charge par le membre.</p>
      {hist && <UserHistoryModal user={hist} onClose={() => setHist(null)} />}
    </div>
  );
}

function Users() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "MEMBER", companyId: "", departmentId: "" });
  const [hist, setHist] = useState(null);

  const load = () => usersApi.list().then(({ users }) => setUsers(users)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch(() => {});
    departmentsApi.companies().then(({ companies }) => setCompanies(companies)).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await usersApi.create({ ...form, departmentId: form.departmentId || null });
      setForm({ name: "", email: "", password: "", role: "MEMBER", companyId: "", departmentId: "" });
      load();
    } catch (e2) { setErr(e2.message); }
  };
  const remove = async (id) => { setErr(""); try { await usersApi.remove(id); load(); } catch (e) { setErr(e.message); } };
  const changeRole = async (u, role) => { setErr(""); try { await usersApi.update(u.id, { role }); load(); } catch (e) { setErr(e.message); } };
  const changeDept = async (u, departmentId) => { setErr(""); try { await usersApi.update(u.id, { departmentId: departmentId || null }); load(); } catch (e) { setErr(e.message); } };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {err && <div className="error-box">{err}</div>}
      <form onSubmit={create} className="card card-pad" style={{ display: "grid", gap: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>Nouvel utilisateur</div>
        <div className="cols-3">
          <input className="input" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input" type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="MEMBER">Membre</option><option value="ADMIN">Admin</option>
          </select>
          <select className="select" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
            <option value="">— Entreprise —</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} disabled={form.role === "ADMIN"}>
            <option value="">— Service —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : " (commun)"}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" style={{ justifySelf: "start" }}>Créer l'utilisateur</button>
      </form>

      <table className="data-table">
        <thead><tr><th>Nom</th><th>Email</th><th>Entreprise</th><th>Rôle</th><th>Service</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><button className="row-link" onClick={() => setHist(u)} title="Voir l'historique des actions">{u.name}</button></td>
              <td className="muted">{u.email}</td>
              <td>{u.company ? <EmitterBadge company={u.company} /> : "—"}</td>
              <td>
                <select className="select" style={{ padding: "5px 8px", width: "auto" }} value={u.role} disabled={u.id === current.id} onChange={(e) => changeRole(u, e.target.value)}>
                  <option value="MEMBER">Membre</option><option value="ADMIN">Admin</option>
                </select>
              </td>
              <td>
                {u.role === "ADMIN" ? (
                  <span className="muted">—</span>
                ) : (
                  <select className="select" style={{ padding: "5px 8px", width: "auto", maxWidth: 220 }} value={u.department?.id || ""} onChange={(e) => changeDept(u, e.target.value)}>
                    <option value="">— Aucun service —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : " (commun)"}</option>)}
                  </select>
                )}
              </td>
              <td style={{ textAlign: "right" }}>{u.id !== current.id && <button className="btn btn-danger btn-sm" onClick={() => remove(u.id)}>Supprimer</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hist && <UserHistoryModal user={hist} onClose={() => setHist(null)} />}
    </div>
  );
}

function Depts() {
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name: "", code: "", companyId: "" });
  const [coForm, setCoForm] = useState({ name: "", slug: "", color: "#4f9d77" });
  const [err, setErr] = useState("");

  const loadCompanies = () => departmentsApi.companies().then(({ companies }) => setCompanies(companies)).catch(() => {});
  const load = () => departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch((e) => setErr(e.message));
  useEffect(() => { load(); loadCompanies(); }, []);

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try { await departmentsApi.create({ ...form, companyId: form.companyId || null }); setForm({ name: "", code: "", companyId: "" }); load(); }
    catch (e2) { setErr(e2.message); }
  };

  const createCompany = async (e) => {
    e.preventDefault(); setErr("");
    try { await departmentsApi.createCompany(coForm); setCoForm({ name: "", slug: "", color: "#4f9d77" }); loadCompanies(); }
    catch (e2) { setErr(e2.message); }
  };

  const removeDept = async (id, name) => {
    if (!window.confirm(`Supprimer le service « ${name} » ?`)) return;
    setErr("");
    try { await departmentsApi.remove(id); load(); } catch (e2) { setErr(e2.message); }
  };
  const removeCompany = async (id, name) => {
    if (!window.confirm(`Supprimer l'entreprise « ${name} » ?`)) return;
    setErr("");
    try { await departmentsApi.removeCompany(id); loadCompanies(); } catch (e2) { setErr(e2.message); }
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {err && <div className="error-box">{err}</div>}

      <form onSubmit={createCompany} className="card card-pad" style={{ display: "grid", gap: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>Nouvelle entreprise</div>
        <div className="cols-3">
          <input className="input" placeholder="Nom (ex. Filiale Sud)" value={coForm.name} onChange={(e) => setCoForm({ ...coForm, name: e.target.value })} required />
          <input className="input" placeholder="Slug (ex. fsud)" value={coForm.slug} onChange={(e) => setCoForm({ ...coForm, slug: e.target.value })} required />
          <div className="row" style={{ gap: 8 }}>
            <input type="color" value={coForm.color} onChange={(e) => setCoForm({ ...coForm, color: e.target.value })} style={{ width: 44, height: 38, border: "1px solid var(--border-strong)", borderRadius: 8, padding: 2, background: "var(--surface)" }} title="Couleur du badge" />
            <span className="emit"><span className="e-mono" style={{ background: coForm.color, color: inkOn(coForm.color) }}>{(coForm.slug || "??").toUpperCase().slice(0, 3)}</span><span className="e-name">{coForm.name || "Aperçu"}</span></span>
          </div>
        </div>
        <button className="btn btn-primary" style={{ justifySelf: "start" }}>Créer l'entreprise</button>
      </form>

      <div className="group-grid">
        {companies.map((c) => (
          <div key={c.id} className="card card-pad spread">
            <EmitterBadge company={c} withName />
            <button className="icon-btn" title="Supprimer l'entreprise" onClick={() => removeCompany(c.id, c.name)}><Icon name="trash" /></button>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="card card-pad" style={{ display: "grid", gap: 12 }}>
        <div className="section-label" style={{ margin: 0 }}>Nouveau service</div>
        <div className="cols-3">
          <input className="input" placeholder="Nom (ex. Logistique)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Code (ex. wca-logistique)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <select className="select" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
            <option value="">Commun (les deux)</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" style={{ justifySelf: "start" }}>Créer</button>
      </form>

      <div className="group-grid">
        {departments.map((d) => (
          <div key={d.id} className="card card-pad">
            <div className="spread">
              <div><div style={{ fontWeight: 600 }}>{d.name}</div><div className="mono muted" style={{ fontSize: 12 }}>{d.code}</div></div>
              <div className="row" style={{ gap: 8 }}>
                {d.company ? <EmitterBadge company={d.company} /> : <span className="muted" style={{ fontSize: 12 }}>commun</span>}
                <button className="icon-btn" title="Supprimer le service" onClick={() => removeDept(d.id, d.name)}><Icon name="trash" /></button>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>Responsable</span>
              <ResponsibleSelect dept={d} onChanged={load} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sélecteur du responsable d'un service — charge les membres au focus, PATCH au changement.
function ResponsibleSelect({ dept, onChanged }) {
  const [members, setMembers] = useState(null);
  const [val, setVal] = useState(dept.responsible?.id || "");
  const [busy, setBusy] = useState(false);

  const loadMembers = () => {
    if (members) return;
    departmentsApi.members(dept.id).then(({ members }) => setMembers(members)).catch(() => setMembers([]));
  };
  const change = async (e) => {
    const id = e.target.value;
    setVal(id); setBusy(true);
    try { await departmentsApi.setResponsible(dept.id, id || null); onChanged?.(); }
    catch { setVal(dept.responsible?.id || ""); }
    finally { setBusy(false); }
  };

  return (
    <select className="select" style={{ padding: "5px 8px", maxWidth: 220 }} value={val} onFocus={loadMembers} onChange={change} disabled={busy}>
      <option value="">— Aucun responsable —</option>
      {!members && dept.responsible && <option value={dept.responsible.id}>{dept.responsible.name}</option>}
      {members && members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

/* ---------------- Audit ---------------- */
function Audit() {
  const [data, setData] = useState(null);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");

  useEffect(() => {
    auditApi.list({ action, page, pageSize: 40 }).then(setData).catch((e) => setErr(e.message));
  }, [action, page]);

  const exportCsv = async () => {
    setErr("");
    try { await downloadFile(`/audit/export${action ? `?action=${action}` : ""}`, "audit.csv"); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {err && <div className="error-box">{err}</div>}
      <div className="toolbar">
        <select className="select" style={{ maxWidth: 240 }} value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }}>
          <option value="">Toutes les actions</option>
          {EVENT_ACTIONS.map((a) => <option key={a} value={a}>{EVENT_META[a].label}</option>)}
        </select>
        <div style={{ marginLeft: "auto" }} />
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Icon name="file" />Exporter CSV</button>
      </div>

      {!data ? (
        <div className="empty">Chargement…</div>
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Action</th><th>Acteur</th><th>Ticket</th><th>Détail</th></tr></thead>
            <tbody>
              {data.events.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 28 }}>Aucun évènement.</td></tr>
              ) : data.events.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDate(e.createdAt)}</td>
                  <td><span className="badge"><Icon name={EVENT_META[e.action]?.icon || "clock"} style={{ width: 12, height: 12 }} />{EVENT_META[e.action]?.label || e.action}</span></td>
                  <td style={{ fontWeight: 600 }}>{e.actor?.name || "Système"}</td>
                  <td className="mono muted" style={{ fontSize: 12 }} title={e.ticket?.title || ""}>{e.ticket?.reference || "—"}</td>
                  <td className="muted">{eventSentence(e.action, e.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="spread">
            <span className="muted" style={{ fontSize: 13 }}>{data.total} évènement{data.total > 1 ? "s" : ""} · page {data.page}/{data.pages || 1}</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-subtle btn-sm" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
              <button className="btn btn-subtle btn-sm" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Paramètres ---------------- */
function Params() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { settingsApi.get().then(({ settings }) => setS(settings)).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error-box">{err}</div>;
  if (!s) return <div className="empty">Chargement…</div>;

  const toggle = async () => {
    const v = !s.suggestionsEnabled;
    setS({ ...s, suggestionsEnabled: v });
    try { await settingsApi.update({ suggestionsEnabled: v }); }
    catch (e) { setErr(e.message); setS((p) => ({ ...p, suggestionsEnabled: !v })); }
  };

  return (
    <div className="card card-pad" style={{ maxWidth: 600 }}>
      <div className="spread">
        <div style={{ paddingRight: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Suggérer un membre à la création</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
            Affiche un champ optionnel « Suggérer un membre » dans le formulaire de demande. La suggestion reste une indication : le ticket demeure visible et prenable par tout le service.
          </div>
        </div>
        <button type="button" className={"toggle" + (s.suggestionsEnabled ? " on" : "")} onClick={toggle} role="switch" aria-checked={s.suggestionsEnabled} aria-label="Activer la suggestion">
          <span className="toggle-knob" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Apparence (marque) ---------------- */
const HEX = /^#[0-9a-fA-F]{6}$/;
function Brand() {
  const { brand, previewBrand, saveBrand, resetBrand } = useBrand();
  const [local, setLocal] = useState(brand);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  // Synchronise quand la marque chargée/enregistrée change.
  useEffect(() => { setLocal(brand); }, [brand]);
  // En quittant l'onglet sans enregistrer, on revient à la marque enregistrée.
  useEffect(() => () => applyBrand(brand), [brand]);

  const change = (field, val) => {
    const next = { ...local, [field]: val };
    setLocal(next); setSaved(false);
    if (HEX.test(val)) previewBrand(next);
  };
  const valid = ["accent", "accentWca", "accentIdc"].every((f) => HEX.test(local[f]));

  const save = async () => {
    if (!valid) { setErr("Couleur invalide (format #RRGGBB)."); return; }
    setBusy(true); setErr("");
    try { await saveBrand(local); setSaved(true); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true); setErr("");
    try { const b = await resetBrand(); setLocal(b); setSaved(true); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const rows = [
    { field: "accent", label: "Couleur principale", hint: "Espace Global, Administration et page de connexion." },
    { field: "accentWca", label: "Couleur WCA", hint: "Espace West Coast Atlantic." },
    { field: "accentIdc", label: "Couleur IDC", hint: "Espace Ivoirienne d'Hydrocarbures." },
  ];

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 640 }}>
      {err && <div className="error-box">{err}</div>}

      <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
        <div>
          <div className="section-label" style={{ margin: 0 }}>Couleurs de marque</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
            Choisissez vos couleurs d'accent. L'aperçu s'applique en direct ; après <strong>Enregistrer</strong>, elles s'appliquent à toute l'application et à la page de connexion.
          </p>
        </div>
        {rows.map((r) => (
          <div className="spread" key={r.field} style={{ alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{r.hint}</div>
            </div>
            <div className="row" style={{ gap: 10, flexShrink: 0 }}>
              <input type="color" value={HEX.test(local[r.field]) ? local[r.field] : "#000000"} onChange={(e) => change(r.field, e.target.value)}
                style={{ width: 44, height: 38, border: "1px solid var(--border-strong)", borderRadius: 8, padding: 2, background: "var(--surface)" }} />
              <input className="input mono" style={{ width: 116, textTransform: "uppercase" }} value={local[r.field]} onChange={(e) => change(r.field, e.target.value)} maxLength={7} />
            </div>
          </div>
        ))}
      </div>

      {/* aperçu */}
      <div className="card card-pad" style={{ display: "grid", gap: 14 }}>
        <div className="section-label" style={{ margin: 0 }}>Aperçu</div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn-primary">Bouton principal</button>
          <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>Étiquette</span>
          {rows.map((r) => (
            <span key={r.field} className="emit"><span className="e-mono" style={{ background: HEX.test(local[r.field]) ? local[r.field] : "#ccc", color: inkOn(local[r.field]) }}>{r.field === "accent" ? "GL" : r.field === "accentWca" ? "WCA" : "IDC"}</span></span>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || !valid}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button className="btn btn-subtle" onClick={reset} disabled={busy}>Réinitialiser (défaut)</button>
        {saved && <span className="muted" style={{ fontSize: 13, color: "var(--st-resolu)" }}>✓ Enregistré</span>}
      </div>
    </div>
  );
}

// (UserHistoryModal est désormais importé depuis components/UserHistoryModal.jsx)
