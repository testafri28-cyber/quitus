import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ServicePicker, groupsForSpace } from "../components/Controls.jsx";
import { departmentsApi, ticketsApi, settingsApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { TYPE_META, TYPES, URGENCY_META, URGENCIES, groupOf } from "../lib/design.js";
import { SPACE_API } from "../lib/design.js";

function TypeCards({ value, onChange }) {
  return (
    <div className="type-grid">
      {TYPES.map((t) => {
        const m = TYPE_META[t];
        return (
          <button type="button" key={t} className={"type-card" + (value === t ? " sel" : "")} onClick={() => onChange(t)}>
            <span className="tc-ico"><Icon name={m.icon} /></span>
            <span style={{ flex: 1 }}>
              <span className="tc-title">{m.label}</span>
              <span className="tc-desc">{m.desc}</span>
            </span>
            <span className="tc-check"><Icon name="check" style={{ width: 13, height: 13 }} /></span>
          </button>
        );
      })}
    </div>
  );
}

export default function Submit() {
  const { space } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [departments, setDepartments] = useState([]);
  const [type, setType] = useState("INTERVENTION");
  const [title, setTitle] = useState("");
  const [service, setService] = useState(searchParams.get("service") || null);
  const [members, setMembers] = useState([]);
  const [suggested, setSuggested] = useState("");
  const [suggestEnabled, setSuggestEnabled] = useState(true);
  const [urgency, setUrgency] = useState("NORMAL");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch((e) => setError(e.message));
    settingsApi.get().then(({ settings }) => setSuggestEnabled(settings.suggestionsEnabled)).catch(() => {});
  }, []);

  // Membres du service choisi (pour la suggestion douce).
  useEffect(() => {
    setSuggested("");
    if (!service) { setMembers([]); return; }
    departmentsApi.members(service).then(({ members }) => setMembers(members)).catch(() => setMembers([]));
  }, [service]);

  // Services visibles dans l'espace courant.
  const visibleDepts = useMemo(() => {
    const groups = groupsForSpace(space);
    return departments.filter((d) => groups.includes(groupOf(d)));
  }, [departments, space]);

  const valid = title.trim() && service && desc.trim();

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("type", type);
      fd.append("urgency", urgency);
      fd.append("space", SPACE_API[space] || "GLOBAL");
      fd.append("departmentId", service);
      if (suggested) fd.append("suggestedToId", suggested);
      fd.append("description", desc.trim());
      if (file) fd.append("attachment", file);
      const { ticket } = await ticketsApi.create(fd);
      showToast("Demande soumise avec succès.", { to: `/${space}/tickets/${ticket.id}`, label: `Ouvrir ${ticket.reference}` });
      navigate(`/${space}/dashboard`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <div className="page narrow">
        <div className="page-head">
          <h1 className="page-title">Nouvelle demande</h1>
          <p className="page-sub">Décrivez votre besoin — la demande sera routée vers le service destinataire choisi.</p>
        </div>

        <div className="card card-pad">
          {error && <div className="error-box" style={{ marginBottom: 18 }}>{error}</div>}

          <div className="field">
            <label className="label">Type de demande</label>
            <TypeCards value={type} onChange={setType} />
          </div>

          <div className="field">
            <label className="label">Titre de la demande</label>
            <input className="input"
              placeholder={type === "INTERVENTION" ? "Ex. Pompe de transfert HCL bac n°3 en défaut" : "Ex. Planification audit QHSE trimestriel"}
              value={title} onChange={(e) => setTitle(e.target.value)} />
            {touched && !title.trim() && <div className="hint" style={{ color: "var(--u-urgente)" }}>Le titre est obligatoire.</div>}
          </div>

          <div className="field">
            <label className="label">Service destinataire</label>
            <ServicePicker departments={visibleDepts} value={service} onChange={setService} space={space} />
            {touched && !service && <div className="hint" style={{ color: "var(--u-urgente)" }}>Choisissez un service.</div>}
          </div>

          {service && suggestEnabled && (
            <div className="field">
              <label className="label">Suggérer un membre <span className="opt">· optionnel</span></label>
              {members.length > 0 ? (
                <>
                  <select className="select" value={suggested} onChange={(e) => setSuggested(e.target.value)}>
                    <option value="">— Laisser l'équipe se répartir —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <div className="hint">Indication non contraignante : le ticket reste visible et prenable par tout le service.</div>
                </>
              ) : (
                <div className="hint">Aucun membre n'est encore rattaché à ce service — le ticket ira dans sa file.</div>
              )}
            </div>
          )}

          <div className="field">
            <label className="label">Niveau d'urgence</label>
            <div className="seg">
              {URGENCIES.map((u) => {
                const m = URGENCY_META[u];
                return (
                  <button type="button" key={u} className={(urgency === u ? "sel " : "") + m.cls} onClick={() => setUrgency(u)}>
                    <span className="u-dot" />{m.label}
                  </button>
                );
              })}
            </div>
            <div className="hint">{URGENCY_META[urgency].hint}</div>
          </div>

          <div className="field">
            <label className="label">Description</label>
            <textarea className="textarea" placeholder="Contexte, localisation, ce qui est attendu…" value={desc} onChange={(e) => setDesc(e.target.value)} />
            {touched && !desc.trim() && <div className="hint" style={{ color: "var(--u-urgente)" }}>Ajoutez une description.</div>}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Pièce jointe <span className="opt">· optionnel</span></label>
            {file ? (
              <div className="file-chip">
                <span className="fc-ico"><Icon name="file" /></span>
                <span style={{ flex: 1 }}>
                  <div className="fc-name">{file.name}</div>
                  <div className="fc-size mono">{(file.size / 1024).toFixed(0)} Ko</div>
                </span>
                <button className="icon-btn" onClick={() => setFile(null)} title="Retirer"><Icon name="x" /></button>
              </div>
            ) : (
              <label className="dropzone">
                <span className="dz-ico"><Icon name="upload" /></span>
                <span>
                  <div className="dz-title">Glissez un fichier ou cliquez pour parcourir</div>
                  <div className="dz-sub">PDF, image ou tableur — 10 Mo max</div>
                </span>
                <input type="file" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
        </div>

        <div className="spread" style={{ marginTop: 22 }}>
          <button className="btn btn-subtle" onClick={() => navigate(`/${space}/dashboard`)}>Annuler</button>
          <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy || !valid}>
            <Icon name="send" />{busy ? "Envoi…" : "Soumettre la demande"}
          </button>
        </div>
      </div>
    </div>
  );
}
