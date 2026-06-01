import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { departmentsApi, ticketsApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { LEAVE_KEYS, LEAVE_KINDS, URGENCIES, URGENCY_META, SPACE_API } from "../lib/design.js";

const frDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

export default function LeaveRequest() {
  const { space } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rh, setRh] = useState(null);
  const [kind, setKind] = useState("paye");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [motif, setMotif] = useState("");
  const [file, setFile] = useState(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    departmentsApi.list()
      .then(({ departments }) => setRh(departments.find((d) => d.code === "rh") || null))
      .catch((e) => setError(e.message));
  }, []);

  const datesValid = start && end && new Date(end) >= new Date(start);
  const valid = datesValid && rh;

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setError("");
    setBusy(true);
    try {
      const title = `${LEAVE_KINDS[kind]} du ${frDate(start)} au ${frDate(end)}`;
      const fd = new FormData();
      fd.append("title", title);
      fd.append("type", "NEED");
      fd.append("urgency", urgency);
      fd.append("space", SPACE_API[space] || "GLOBAL");
      fd.append("departmentId", rh.id);
      fd.append("description", motif.trim() || `Demande de ${LEAVE_KINDS[kind].toLowerCase()}.`);
      fd.append("leaveStart", start);
      fd.append("leaveEnd", end);
      fd.append("leaveKind", kind);
      if (file) fd.append("attachment", file);
      const { ticket } = await ticketsApi.create(fd);
      showToast("Demande de congé transmise aux RH.", { to: `/${space}/tickets/${ticket.id}`, label: `Ouvrir ${ticket.reference}` });
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
          <h1 className="page-title">Demande de congé</h1>
          <p className="page-sub">Votre demande sera transmise au service Ressources Humaines pour validation.</p>
        </div>

        <div className="card card-pad">
          {error && <div className="error-box" style={{ marginBottom: 18 }}>{error}</div>}

          <div className="field">
            <label className="label">Type de congé</label>
            <div className="seg" style={{ flexWrap: "wrap" }}>
              {LEAVE_KEYS.map((k) => (
                <button type="button" key={k} className={kind === k ? "sel" : ""} onClick={() => setKind(k)}>
                  {LEAVE_KINDS[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="grid-form">
              <div>
                <label className="label">Du</label>
                <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="label">Au</label>
                <input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} min={start || undefined} />
              </div>
            </div>
            {touched && !datesValid && <div className="hint" style={{ color: "var(--u-urgente)" }}>Renseignez des dates valides (fin ≥ début).</div>}
          </div>

          <div className="field">
            <label className="label">Priorité</label>
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
          </div>

          <div className="field">
            <label className="label">Motif <span className="opt">· optionnel</span></label>
            <textarea className="textarea" style={{ minHeight: 90 }} placeholder="Précisez si besoin (remplacement prévu, contexte…)" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Pièce jointe <span className="opt">· optionnel — justificatif, formulaire pré-rempli…</span></label>
            {file ? (
              <div className="file-chip">
                <span className="fc-ico"><Icon name="file" /></span>
                <span style={{ flex: 1 }}>
                  <div className="fc-name">{file.name}</div>
                  <div className="fc-size mono">{(file.size / 1024).toFixed(0)} Ko</div>
                </span>
                <button type="button" className="icon-btn" onClick={() => setFile(null)} title="Retirer"><Icon name="x" /></button>
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
            <Icon name="calendar" />{busy ? "Envoi…" : "Envoyer la demande"}
          </button>
        </div>
      </div>
    </div>
  );
}
