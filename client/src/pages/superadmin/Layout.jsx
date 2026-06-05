import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { useSuperAuth } from "./SuperAuth.jsx";
import { superadminApi } from "../../api/superadmin.js";
import "./superadmin.css";

function AccountModal({ email, onClose }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 8) return setErr("Le nouveau mot de passe doit faire au moins 8 caractères.");
    setBusy(true);
    try { await superadminApi.changePassword(cur, next); setDone(true); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <div className="modal-head">
          <span style={{ fontWeight: 700 }}>Mon compte</span>
          <button className="icon-btn" onClick={onClose} title="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{email}</div>
          {done ? (
            <div className="error-box" style={{ background: "color-mix(in srgb, var(--st-resolu) 12%, white)", color: "var(--st-resolu)", border: "1px solid color-mix(in srgb, var(--st-resolu) 30%, white)" }}>✓ Mot de passe modifié.</div>
          ) : (
            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div className="sa-card-h" style={{ margin: 0 }}>Changer mon mot de passe</div>
              {err && <div className="error-box">{err}</div>}
              <input className="input" type="password" placeholder="Mot de passe actuel" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
              <input className="input" type="password" placeholder="Nouveau mot de passe (8 caractères min.)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
              <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={busy}>{busy ? "Modification…" : "Changer le mot de passe"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/superadmin", end: true, icon: "grid", label: "Tableau de bord" },
  { to: "/superadmin/tenants", icon: "inbox", label: "Clients" },
  { to: "/superadmin/invoices", icon: "file", label: "Factures" },
  { to: "/superadmin/revenue", icon: "sliders", label: "Revenus" },
];

export default function SuperadminLayout() {
  const { admin, loading, logout } = useSuperAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [acct, setAcct] = useState(false);

  if (loading) return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--text-3)" }}>Chargement…</div>;
  // Garde d'accès : session backoffice requise → sinon, login dédié.
  if (!admin) return <Navigate to="/superadmin/login" replace />;

  const close = () => setNavOpen(false);

  return (
    <div className={"sa-app" + (navOpen ? " nav-open" : "")}>
      <div className="sa-overlay" onClick={close} />

      <aside className="sa-side">
        <div className="sa-brand">
          <span className="sa-logo">Q</span>
          <span>
            <div className="sa-b-name">Quitus</div>
            <div className="sa-b-sub">Backoffice éditeur</div>
          </span>
        </div>

        <div className="sa-navlabel">Pilotage SaaS</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => "sa-nav" + (isActive ? " active" : "")} onClick={close}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}

        <div className="sa-side-foot">
          <div className="sa-user">{admin.email}</div>
          <button className="sa-logout" onClick={() => setAcct(true)}>
            <Icon name="lock" />
            <span>Mon compte</span>
          </button>
          <button className="sa-logout" onClick={() => { logout(); navigate("/superadmin/login"); }}>
            <Icon name="logout" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <button className="sa-burger" onClick={() => setNavOpen((v) => !v)} aria-label="Menu"><Icon name="panelLeft" /></button>
          <span className="sa-tt">Espace éditeur</span>
        </header>
        <Outlet />
      </div>

      {acct && <AccountModal email={admin.email} onClose={() => setAcct(false)} />}
    </div>
  );
}
