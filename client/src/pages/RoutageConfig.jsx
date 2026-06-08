import { useEffect, useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { configApi, usersApi } from "../api/endpoints.js";
import { URGENCY_META } from "../lib/design.js";

const JOURS = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [7, "Dim"]];

// Configuration du routage/SLA (admin) : grille SLA, calendrier ouvré, fériés, modérateurs.
export function RoutageConfig() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [sla, setSla] = useState([]);
  const [cal, setCal] = useState(null);
  const [newFerie, setNewFerie] = useState({ date: "", libelle: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    configApi.get().then((d) => {
      setData(d);
      setSla(d.sla.map((s) => ({ ...s })));
      setCal(d.calendrier ? { ...d.calendrier } : { jours: [1, 2, 3, 4, 5], heureDebut: "08:00", heureFin: "16:30", pauseDebut: "12:00", pauseFin: "14:00" });
    }).catch((e) => setErr(e.message));
    usersApi.list().then(({ users }) => setUsers(users)).catch(() => {});
  };
  useEffect(load, []);

  const flash = (m) => { setMsg(m); setErr(""); setTimeout(() => setMsg(""), 2500); };
  const saveSla = async () => {
    try { await configApi.saveSla(sla.map((s) => ({ urgence: s.urgence, priseEnMainH: Number(s.priseEnMainH), rappelH: Number(s.rappelH), escaladeH: Number(s.escaladeH) }))); flash("Grille SLA enregistrée."); }
    catch (e) { setErr(e.message); }
  };
  const saveCal = async () => {
    try { await configApi.saveCalendrier({ jours: cal.jours, heureDebut: cal.heureDebut, heureFin: cal.heureFin, pauseDebut: cal.pauseDebut || null, pauseFin: cal.pauseFin || null }); flash("Calendrier enregistré."); }
    catch (e) { setErr(e.message); }
  };
  const addFerie = async () => {
    if (!newFerie.date || !newFerie.libelle.trim()) return;
    try { await configApi.addFerie(newFerie.date, newFerie.libelle.trim()); setNewFerie({ date: "", libelle: "" }); load(); }
    catch (e) { setErr(e.message); }
  };
  const delFerie = async (id) => { try { await configApi.removeFerie(id); load(); } catch (e) { setErr(e.message); } };
  const toggleDispatcher = async (u, v) => {
    try { await configApi.setDispatcher(u.id, v); setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, peutDispatcher: v } : x))); }
    catch (e) { setErr(e.message); }
  };

  if (!data || !cal) return <div className="empty">Chargement…</div>;

  const parEntreprise = {};
  for (const u of users) { if (u.peutDispatcher) { const c = u.company?.name || "—"; parEntreprise[c] = (parEntreprise[c] || 0) + 1; } }
  const sousDeux = [...new Set(users.map((u) => u.company?.name).filter(Boolean))].filter((c) => (parEntreprise[c] || 0) < 2);
  const setSlaCell = (i, k, v) => setSla((arr) => arr.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {msg && <div className="hint" style={{ color: "var(--st-resolu)" }}>✓ {msg}</div>}
      {err && <div className="error-box">{err}</div>}

      <div className="card card-pad">
        <div className="section-label">Grille SLA — heures ouvrées</div>
        <table className="data-table" style={{ marginBottom: 12 }}>
          <thead><tr><th>Urgence</th><th>Prise en main (h)</th><th>Rappel (h)</th><th>Escalade (h)</th></tr></thead>
          <tbody>
            {sla.map((s, i) => (
              <tr key={s.urgence}>
                <td><span className={"urg " + (URGENCY_META[s.urgence]?.cls || "")}><span className="u-dot" />{URGENCY_META[s.urgence]?.label || s.urgence}</span></td>
                {["priseEnMainH", "rappelH", "escaladeH"].map((k) => (
                  <td key={k}><input className="input" type="number" step="0.5" min="0.5" style={{ width: 90 }} value={s[k]} onChange={(e) => setSlaCell(i, k, e.target.value)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-primary btn-sm" onClick={saveSla}>Enregistrer la grille</button>
      </div>

      <div className="card card-pad">
        <div className="section-label">Heures ouvrées</div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {JOURS.map(([n, l]) => (
            <button key={n} type="button" className={"btn btn-sm " + (cal.jours.includes(n) ? "btn-primary" : "btn-subtle")}
              onClick={() => setCal((c) => ({ ...c, jours: c.jours.includes(n) ? c.jours.filter((x) => x !== n) : [...c.jours, n].sort() }))}>{l}</button>
          ))}
        </div>
        <div className="grid-form" style={{ maxWidth: 520 }}>
          <div><label className="label">Début</label><input className="input" type="time" value={cal.heureDebut} onChange={(e) => setCal({ ...cal, heureDebut: e.target.value })} /></div>
          <div><label className="label">Fin</label><input className="input" type="time" value={cal.heureFin} onChange={(e) => setCal({ ...cal, heureFin: e.target.value })} /></div>
          <div><label className="label">Pause début</label><input className="input" type="time" value={cal.pauseDebut || ""} onChange={(e) => setCal({ ...cal, pauseDebut: e.target.value })} /></div>
          <div><label className="label">Pause fin</label><input className="input" type="time" value={cal.pauseFin || ""} onChange={(e) => setCal({ ...cal, pauseFin: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={saveCal}>Enregistrer le calendrier</button>
        <div className="hint">L&apos;horloge SLA se fige hors de ces plages, le week-end et les jours fériés.</div>
      </div>

      <div className="card card-pad">
        <div className="section-label">Jours fériés</div>
        <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input className="input" type="date" style={{ maxWidth: 180 }} value={newFerie.date} onChange={(e) => setNewFerie({ ...newFerie, date: e.target.value })} />
          <input className="input" placeholder="Libellé" style={{ maxWidth: 240 }} value={newFerie.libelle} onChange={(e) => setNewFerie({ ...newFerie, libelle: e.target.value })} />
          <button className="btn btn-subtle btn-sm" onClick={addFerie}><Icon name="plus" />Ajouter</button>
        </div>
        {data.feries.length === 0 ? <div className="hint">Aucun jour férié.</div> : (
          <div style={{ display: "grid", gap: 4 }}>
            {data.feries.map((f) => (
              <div key={f.id} className="spread" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span><span className="mono" style={{ fontSize: 12.5 }}>{new Date(f.date).toISOString().slice(0, 10)}</span> · {f.libelle}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => delFerie(f.id)}><Icon name="trash" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="section-label">Modérateurs (boîte de tri)</div>
        {sousDeux.length > 0 && <div className="error-box" style={{ marginBottom: 12 }}>Moins de 2 modérateurs dans : {sousDeux.join(", ")}. Désignez-en au moins deux par entreprise.</div>}
        <table className="data-table">
          <thead><tr><th>Utilisateur</th><th>Entreprise</th><th>Service</th><th>Modérateur</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<div className="mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>{u.email}</div></td>
                <td>{u.company?.name || "—"}</td>
                <td>{u.department?.name || "—"}</td>
                <td><span className={"toggle" + (u.peutDispatcher ? " on" : "")} role="switch" aria-checked={!!u.peutDispatcher} onClick={() => toggleDispatcher(u, !u.peutDispatcher)}><span className="toggle-knob" /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
