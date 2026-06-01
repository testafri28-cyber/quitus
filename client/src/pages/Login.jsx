import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homePathFor } from "../lib/spaces.js";

const ADMIN = { label: "Admin", email: "adnan.moghnieh@idc.ci" };
// Tous des membres (même profil) — on indique l'entreprise, pas le service.
const MEMBERS = [
  { label: "Boti · IDC", email: "boti.raoul@idc.ci" },
  { label: "Yapo · IDC", email: "yapo.arthur@idc.ci" },
  { label: "Éboulé · WCA", email: "eboule.jacqueline@wca.ci" },
  { label: "Koffi · WCA", email: "employe.wca@wca.ci" },
  { label: "Salif · WCA", email: "salif.diallo@wca.ci" },
  { label: "Aya · IDC", email: "employe.idc@idc.ci" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(homePathFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fill = (e) => { setEmail(e); setPassword("password123"); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logos">
            <span className="monogram" style={{ background: "#378add", color: "#fff" }}>WCA</span>
            <span className="monogram" style={{ background: "#ef9f27", color: "#3c2c08" }}>IDC</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", margin: 0 }}>Quitus</h1>
          <p className="muted" style={{ fontSize: 14, margin: "4px 0 0" }}>Gestion de tickets — WCA × IDC</p>
        </div>

        <form onSubmit={handleSubmit} className="card card-pad" style={{ display: "grid", gap: 16 }}>
          {error && <div className="error-box">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 11.5, textAlign: "center", textTransform: "uppercase", letterSpacing: ".08em", margin: "18px 0 0" }}>
          Comptes de démo · password123
        </p>
        <div className="demo-chips" style={{ marginTop: 12 }}>
          <button className="demo-chip demo-chip-admin" onClick={() => fill(ADMIN.email)}>{ADMIN.label}</button>
        </div>
        <p className="muted" style={{ fontSize: 11, textAlign: "center", margin: "12px 0 0" }}>
          Membres — même profil, services différents
        </p>
        <div className="demo-chips">
          {MEMBERS.map((m) => (
            <button key={m.email} className="demo-chip" onClick={() => fill(m.email)}>{m.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
