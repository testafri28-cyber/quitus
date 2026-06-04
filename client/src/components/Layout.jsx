import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";
import { ticketsApi } from "../api/endpoints.js";
import { SPACE_META } from "../lib/spaces.js";

const SCREEN_LABELS = {
  "": "Accueil",
  form: "Nouvelle demande",
  leave: "Demande de congé",
  chat: "Discussion",
  services: "Annuaire des services",
  gestion: "Gestion",
  tickets: "Ticket",
};

function dashboardLabel(space) {
  return space === "admin" ? "Toutes les demandes" : space === "global" ? "Suivi des demandes" : "File de tickets";
}

export function Layout() {
  const { space } = useParams();
  const location = useLocation();
  const [counts, setCounts] = useState({ total: 0, open: 0 });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false); // tiroir de navigation sur petit écran

  const toggleSidebar = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  };

  // Compteurs pour les badges de la sidebar (légers, recalculés au changement d'écran).
  useEffect(() => {
    let active = true;
    ticketsApi
      .list({ pageSize: 100 })
      .then(({ tickets }) => {
        if (!active) return;
        setCounts({
          total: tickets.length,
          open: tickets.filter((t) => t.status === "NEW" || t.status === "IN_PROGRESS").length,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);

  // Ferme le tiroir mobile à chaque changement d'écran.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Écran courant = segment après /:space
  const parts = location.pathname.split("/").filter(Boolean); // ['wca','dashboard']
  const seg = parts[1] || "";
  const screen = seg === "tickets" ? "dashboard" : seg; // un détail reste dans la rubrique file

  const sp = SPACE_META[space] || SPACE_META.global;
  const spaceLabel = space === "global" ? "Espace Global" : space === "admin" ? "Administration" : sp.mono;
  const screenLabel = seg === "dashboard" ? dashboardLabel(space) : (SCREEN_LABELS[seg] ?? "");
  const crumbs = [spaceLabel, screenLabel].filter(Boolean);

  return (
    <div className={"app" + (collapsed ? " collapsed" : "") + (mobileOpen ? " mobile-nav-open" : "")} data-space={space}>
      <Sidebar space={space} screen={screen} counts={counts} collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="nav-overlay" onClick={() => setMobileOpen(false)} />
      <div className="main">
        <Topbar space={space} crumbs={crumbs} onMenu={() => setMobileOpen(true)} />
        <Outlet context={{ space }} />
      </div>
    </div>
  );
}
