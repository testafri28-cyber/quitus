import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon.jsx";
import { useSuperAuth } from "./SuperAuth.jsx";
import "./superadmin.css";

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
    </div>
  );
}
