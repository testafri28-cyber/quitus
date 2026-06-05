import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSuperAuth } from "./SuperAuth.jsx";
import { QuitusMark } from "./QuitusMark.jsx";
import "./superadmin.css";

export default function SaLogin() {
  const { admin, loading, login } = useSuperAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (loading) return null;
  if (admin) return <Navigate to="/superadmin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email.trim().toLowerCase(), password); navigate("/superadmin"); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="sa-login">
      <form className="sa-login-card" onSubmit={submit}>
        <div className="sa-login-brand">
          <span className="sa-logo" style={{ width: 46, height: 46, background: "#fff", borderRadius: 12, display: "grid", placeItems: "center", boxShadow: "var(--shadow-sm)" }}><QuitusMark size={30} /></span>
          <div>
            <div className="sa-login-title">Quitus · Backoffice</div>
            <div className="sa-login-sub">Espace éditeur</div>
          </div>
        </div>
        <p className="sa-login-hint">Connexion réservée au personnel Quitus — distincte de l'espace client.</p>
        {err && <div className="error-box" style={{ marginBottom: 14 }}>{err}</div>}
        <label className="label">E-mail</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@quitus.ci" autoComplete="username" required autoFocus />
        <label className="label" style={{ marginTop: 12 }}>Mot de passe</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
