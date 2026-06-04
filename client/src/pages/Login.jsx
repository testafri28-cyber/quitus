import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homePathFor } from "../lib/spaces.js";
import "../styles/login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- petites icônes inline (reprises du HViewBox) ---- */
const TicketIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="17" /><line x1="9.5" y1="14.5" x2="14.5" y2="14.5" />
  </svg>
);
const EyeOn = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const MonitorIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
);
const UsersIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
);
const FinanceIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
);

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Déjà connecté → on file directement vers le bon espace.
  if (user) return <Navigate to={homePathFor(user)} replace />;

  const emailErr = !email.trim() ? "L'adresse e-mail est requise." : !EMAIL_RE.test(email.trim()) ? "Format d'e-mail invalide." : "";
  const pwdErr = !password ? "Le mot de passe est requis." : password.length < 6 ? "Au moins 6 caractères." : "";
  const valid = !emailErr && !pwdErr;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (!valid) return;
    setBusy(true);
    try {
      const u = await login(email.trim(), password); // POST /api/auth/login → stocke le JWT
      navigate(homePathFor(u), { replace: true });    // redirige selon l'espace (wca/idc/global/admin)
    } catch (err) {
      setError(err.message || "Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-split">
      {/* ----------------- GAUCHE : formulaire ----------------- */}
      <div className="lg-left">
        <div className="lg-logo">
          <span className="lg-logo-ico"><TicketIco /></span>
          <span className="lg-logo-name">Tickets</span>
        </div>

        <form className="lg-form" onSubmit={handleSubmit} noValidate>
          <h1 className="lg-title">Connexion</h1>
          <p className="lg-sub">Accédez à votre espace de gestion des demandes internes.</p>

          {error && <div className="error-box lg-error">{error}</div>}

          <div className="lg-field">
            <label htmlFor="email">Adresse e-mail</label>
            <div className="lg-input-wrap">
              <input id="email" type="email" autoComplete="email" placeholder="votre.nom@entreprise.ci"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!emailErr} />
            </div>
            {touched && emailErr && <div className="lg-hint">{emailErr}</div>}
          </div>

          <div className="lg-field">
            <label htmlFor="password">Mot de passe</label>
            <div className="lg-input-wrap">
              <input id="password" type={showPwd ? "text" : "password"} autoComplete="current-password" placeholder="Entrez votre mot de passe"
                value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={touched && !!pwdErr} />
              <button type="button" className="lg-eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {showPwd ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
            {touched && pwdErr && <div className="lg-hint">{pwdErr}</div>}
          </div>

          <div className="lg-forgot-row">
            <span className="lg-forgot" title="Contactez votre administrateur pour réinitialiser votre accès.">Mot de passe oublié ?</span>
          </div>

          <button className="lg-btn" type="submit" disabled={busy}>
            {busy ? <><span className="lg-spinner" aria-hidden="true" />Connexion…</> : "Se connecter"}
          </button>

          <p className="lg-note">Votre espace est déterminé automatiquement selon votre profil.</p>
        </form>

        <div className="lg-foot">
          <span>Un problème ? <span className="lg-foot-link">Contactez l'admin</span></span>
          <span className="lg-foot-link">Confidentialité</span>
        </div>
      </div>

      {/* ----------------- DROITE : visuel décoratif ----------------- */}
      <div className="lg-right" aria-hidden="true">
        <div className="lg-glow" />
        <div className="lg-stripes" />

        <div className="lg-rhead">
          <p className="lg-eyebrow">Gestion des demandes</p>
          <h2 className="lg-rtitle">Soumettez,<br />suivez,<br />résolvez.</h2>
        </div>

        {/* ticket en cours */}
        <div className="lg-fcard lg-c1">
          <div className="lg-c1-top">
            <span className="lg-c1-type"><span className="lg-pulse" />Intervention</span>
            <span className="lg-c1-badge">Urgente</span>
          </div>
          <div className="lg-c1-title">Imprimante HS — Salle 12</div>
          <div className="lg-c1-meta">Informatique · TCK-000012 · 15:08</div>
        </div>

        {/* services */}
        <div className="lg-fcard lg-c2">
          <div className="lg-c2-head">Services</div>
          <div className="lg-c2-row"><span className="lg-c2-ico ico-b"><MonitorIco /></span><span className="lg-c2-name">Informatique</span></div>
          <div className="lg-c2-row"><span className="lg-c2-ico ico-t"><UsersIco /></span><span className="lg-c2-name">Ressources Humaines</span></div>
          <div className="lg-c2-row"><span className="lg-c2-ico ico-p"><FinanceIco /></span><span className="lg-c2-name">Finance</span></div>
        </div>

        {/* résolu */}
        <div className="lg-fcard lg-c3">
          <div className="lg-c3-top">
            <span className="lg-c3-ok"><span className="lg-c3-check">✓</span>Résolu</span>
            <span className="lg-c3-time">Il y a 2h</span>
          </div>
          <div className="lg-c3-title">Réinitialisation accès VPN</div>
          <div className="lg-c3-avs">
            <span className="lg-av av1">BR</span><span className="lg-av av2">YA</span><span className="lg-av av3">NE</span>
          </div>
        </div>

        {/* stat */}
        <div className="lg-stat">
          <div className="lg-stat-n">21</div>
          <div className="lg-stat-l">services</div>
        </div>
      </div>
    </div>
  );
}
