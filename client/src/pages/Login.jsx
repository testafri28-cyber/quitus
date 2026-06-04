import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homePathFor } from "../lib/spaces.js";
import "../styles/login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- icônes inline ---- */
const TicketIco = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const MonitorIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
);
const UsersIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
);
const FinanceIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
);

// Textes du carrousel (synchronisés avec les 3 slides du panneau droit).
const SLIDES = [
  { title: <>Gérez vos demandes<br />où que vous soyez</>, sub: "Soumettez, suivez et résolvez toutes vos demandes internes depuis un seul espace unifié." },
  { title: <>Chaque demande<br />trouve sa résolution</>, sub: "Vos tickets sont traités et clôturés par les bonnes personnes, au bon moment." },
  { title: <>Tous vos services<br />réunis au même endroit</>, sub: "Informatique, RH, Finance et bien d'autres services accessibles en un clic." },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);

  // Carrousel automatique : avance 4 s après chaque changement (auto ou clic).
  useEffect(() => {
    const t = setTimeout(() => setSlide((s) => (s + 1) % SLIDES.length), 4000);
    return () => clearTimeout(t);
  }, [slide]);

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
      const u = await login(email.trim(), password); // POST /api/auth/login → JWT
      navigate(homePathFor(u), { replace: true });    // redirige selon l'espace
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
          <span className="lg-logo-badge"><TicketIco /></span>
          <span className="lg-logo-name">.Tickets</span>
        </div>

        <form className="lg-form" onSubmit={handleSubmit} noValidate>
          <h1 className="lg-title">Bienvenue !</h1>
          <p className="lg-sub">Entrez vos identifiants pour accéder à votre espace.</p>

          {error && <div className="error-box lg-error">{error}</div>}

          <div className="lg-field">
            <div className="lg-input-wrap">
              <input type="email" autoComplete="email" placeholder="E-mail"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!emailErr} />
            </div>
            {touched && emailErr && <div className="lg-hint">{emailErr}</div>}
          </div>

          <div className="lg-field">
            <div className="lg-input-wrap">
              <input type={showPwd ? "text" : "password"} autoComplete="current-password" placeholder="Mot de passe"
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
        <div className="lg-hexgrid" />
        <div className="lg-glow" />

        {/* formes flottantes */}
        <div className="lg-shape lg-s-diamond"><div /></div>
        <div className="lg-shape lg-s-diamond-sm"><div /></div>
        <div className="lg-shape lg-s-ring"><div /></div>
        <div className="lg-shape lg-s-tri"><div /></div>

        {/* hexagone + slider */}
        <div className="lg-hexwrap">
          <div className="lg-hexbg">
            <svg viewBox="0 0 290 252" xmlns="http://www.w3.org/2000/svg">
              <polygon points="145,5 281,77 281,185 145,247 9,185 9,77" fill="none" stroke="rgba(110,98,182,0.12)" strokeWidth="18" />
              <polygon points="145,5 281,77 281,185 145,247 9,185 9,77" fill="rgba(255,255,255,0.55)" stroke="rgba(110,98,182,0.30)" strokeWidth="1.5" />
              <polygon points="145,18 268,84 268,178 145,234 22,178 22,84" fill="none" stroke="rgba(110,98,182,0.10)" strokeWidth="1" />
            </svg>
          </div>

          <div className="lg-sliderwrap">
            {/* Slide 1 : intervention en cours */}
            <div className={"lg-slide" + (slide === 0 ? " active" : "")}>
              <div className="lg-scard">
                <div className="lg-sc-top">
                  <span className="lg-sc-type"><span className="lg-sc-dot" />Intervention</span>
                  <span className="lg-sc-urg">Urgente</span>
                </div>
                <div className="lg-sc-title">Imprimante HS — Salle 12</div>
                <div className="lg-sc-meta">Informatique · TCK-000012 · 15:08</div>
              </div>
            </div>

            {/* Slide 2 : résolu */}
            <div className={"lg-slide" + (slide === 1 ? " active" : "")}>
              <div className="lg-scard">
                <div className="lg-rc-top">
                  <span className="lg-rc-ok"><span className="lg-rc-check">✓</span>Résolu</span>
                  <span className="lg-rc-time">Il y a 2h</span>
                </div>
                <div className="lg-rc-title">Réinitialisation accès VPN</div>
                <div className="lg-rc-avs">
                  <span className="lg-av av1">BR</span><span className="lg-av av2">YA</span><span className="lg-av av3">NE</span>
                </div>
              </div>
            </div>

            {/* Slide 3 : services */}
            <div className={"lg-slide" + (slide === 2 ? " active" : "")}>
              <div className="lg-scard">
                <div className="lg-svc-header">Services</div>
                <div className="lg-svc-row"><span className="lg-svc-ico ico-b"><MonitorIco /></span><span className="lg-svc-name">Informatique</span></div>
                <div className="lg-svc-row"><span className="lg-svc-ico ico-g"><UsersIco /></span><span className="lg-svc-name">Ressources Humaines</span></div>
                <div className="lg-svc-row"><span className="lg-svc-ico ico-p"><FinanceIco /></span><span className="lg-svc-name">Finance</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* texte + dots */}
        <div className="lg-rfoot">
          <h2 className="lg-rtitle">{SLIDES[slide].title}</h2>
          <p className="lg-rsub">{SLIDES[slide].sub}</p>
          <div className="lg-dots">
            {SLIDES.map((_, i) => (
              <button key={i} className={"lg-dot" + (slide === i ? " active" : "")} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
