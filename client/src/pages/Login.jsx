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

/* ---- illustrations flat des étapes (SVG, palette de l'app) ---- */
const C = { accent: "#6e62b6", accentSoft: "#ece9f6", surface: "#ffffff", border: "#e4e8ee", line: "#eef0f4", green: "#4f9d77", greenSoft: "#e7f2ec", blue: "#5b8def", amber: "#d39a3c", t3: "#8a95a4" };

// Étape 1 — Soumettre : un formulaire qu'on envoie.
const IlluSubmit = () => (
  <svg viewBox="0 0 300 200" width="100%" height="100%" fill="none">
    <rect x="64" y="36" width="150" height="132" rx="16" fill={C.surface} stroke={C.border} strokeWidth="1.5" />
    <rect x="84" y="58" width="62" height="10" rx="5" fill={C.accent} />
    <rect x="84" y="82" width="110" height="12" rx="6" fill={C.line} />
    <rect x="84" y="104" width="110" height="12" rx="6" fill={C.line} />
    <rect x="84" y="134" width="74" height="20" rx="10" fill={C.accent} />
    <rect x="96" y="142" width="34" height="4" rx="2" fill="#fff" opacity="0.85" />
    {/* avion en papier */}
    <g transform="translate(196 28)">
      <circle cx="20" cy="20" r="26" fill={C.accentSoft} />
      <path d="M11 20l20-8-8 20-3-8-9-4z" fill={C.accent} />
    </g>
  </svg>
);

// Étape 2 — Suivre : une barre de progression à 3 jalons.
const IlluTrack = () => (
  <svg viewBox="0 0 300 200" width="100%" height="100%" fill="none">
    <rect x="56" y="97" width="188" height="6" rx="3" fill={C.border} />
    <rect x="56" y="97" width="94" height="6" rx="3" fill={C.accent} />
    <circle cx="60" cy="100" r="17" fill={C.accent} />
    <path d="M53 100l5 5 9-10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle className="lg-illu-pulse" cx="150" cy="100" r="17" fill={C.surface} stroke={C.accent} strokeWidth="3" />
    <circle cx="150" cy="100" r="6" fill={C.accent} />
    <circle cx="240" cy="100" r="17" fill={C.line} stroke={C.border} strokeWidth="1.5" />
    <rect x="44" y="128" width="32" height="7" rx="3.5" fill={C.line} />
    <rect x="134" y="128" width="32" height="7" rx="3.5" fill={C.accentSoft} />
    <rect x="224" y="128" width="32" height="7" rx="3.5" fill={C.line} />
  </svg>
);

// Étape 3 — Résolu : un grand check + petit ticket validé.
const IlluDone = () => (
  <svg viewBox="0 0 300 200" width="100%" height="100%" fill="none">
    <circle cx="150" cy="98" r="48" fill={C.greenSoft} />
    <circle cx="150" cy="98" r="31" fill={C.green} />
    <path d="M138 98l8 8 16-17" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    {/* confettis flat */}
    <rect x="86" y="50" width="11" height="11" rx="2.5" fill={C.accent} transform="rotate(20 91 55)" />
    <rect x="208" y="58" width="9" height="9" rx="2" fill={C.amber} transform="rotate(-15 212 62)" />
    <circle cx="96" cy="140" r="5" fill={C.blue} />
    <circle cx="206" cy="138" r="6" fill={C.accent} opacity="0.6" />
    <rect x="196" y="112" width="9" height="9" rx="2" fill={C.green} transform="rotate(25 200 116)" />
  </svg>
);

// Les 3 étapes (illustration + texte affiché en bas).
const STEPS = [
  { illu: <IlluSubmit />, eyebrow: "Étape 1", title: "Soumettez votre demande", sub: "Décrivez votre intervention ou votre besoin, ajoutez une pièce jointe et choisissez le service concerné." },
  { illu: <IlluTrack />, eyebrow: "Étape 2", title: "Suivez l'avancement", sub: "Statut en temps réel, échanges avec le service et notifications : vous savez toujours où en est votre demande." },
  { illu: <IlluDone />, eyebrow: "Étape 3", title: "Résolu et clôturé", sub: "Le bon service prend en main, résout puis clôture — tout reste tracé dans votre espace." },
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
  const [step, setStep] = useState(0);

  // Carrousel automatique : avance 4,5 s après chaque changement (auto ou clic).
  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 4500);
    return () => clearTimeout(t);
  }, [step]);

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
              <input type="email" autoComplete="email" placeholder="E-mail" aria-label="Adresse e-mail"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!emailErr} />
            </div>
            {touched && emailErr && <div className="lg-hint">{emailErr}</div>}
          </div>

          <div className="lg-field">
            <div className="lg-input-wrap">
              <input type={showPwd ? "text" : "password"} autoComplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe"
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

      {/* ----------------- DROITE : slider d'étapes (illustrations flat) ----------------- */}
      <div className="lg-right" aria-hidden="true">
        <div className="lg-glow" />

        {/* formes flottantes (ambiance) */}
        <div className="lg-shape lg-s-diamond"><div /></div>
        <div className="lg-shape lg-s-ring"><div /></div>

        {/* illustration flat de l'étape active */}
        <div className="lg-illu">
          {STEPS.map((s, i) => (
            <div className={"lg-illu-slide" + (step === i ? " active" : "")} key={i}>{s.illu}</div>
          ))}
        </div>

        {/* texte de l'étape + dots */}
        <div className="lg-rfoot">
          <h2 className="lg-rtitle">{STEPS[step].title}</h2>
          <p className="lg-rsub">{STEPS[step].sub}</p>
          <div className="lg-dots">
            {STEPS.map((_, i) => (
              <button key={i} className={"lg-dot" + (step === i ? " active" : "")} onClick={() => setStep(i)} aria-label={`Étape ${i + 1}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
