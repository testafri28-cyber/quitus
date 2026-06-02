import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { Avatar } from "./Badges.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence } from "../context/PresenceContext.jsx";
import { SPACE_META, allowedSpaces, spaceIndexScreen } from "../lib/spaces.js";
import { ROLE_LABELS } from "../lib/design.js";

function navItemsFor(space, counts, chatUnread) {
  if (space === "global")
    return [
      { k: "", label: "Accueil", icon: "grid" },
      { k: "form", label: "Nouvelle demande", icon: "plusCircle" },
      { k: "leave", label: "Demande de congé", icon: "calendar" },
      { k: "dashboard", label: "Suivi des demandes", icon: "inbox", badge: counts.total },
      { k: "chat", label: "Discussion", icon: "message", badge: chatUnread || undefined },
    ];
  if (space === "admin")
    return [
      { k: "dashboard", label: "Toutes les demandes", icon: "inbox", badge: counts.total },
      { k: "form", label: "Nouvelle demande", icon: "plusCircle" },
      { k: "services", label: "Annuaire des services", icon: "grid" },
      { k: "chat", label: "Discussion", icon: "message", badge: chatUnread || undefined },
      { k: "gestion", label: "Gestion", icon: "settings" },
    ];
  return [
    { k: "dashboard", label: "File de tickets", icon: "inbox", badge: counts.open },
    { k: "form", label: "Nouvelle demande", icon: "plusCircle" },
    { k: "leave", label: "Demande de congé", icon: "calendar" },
    { k: "chat", label: "Discussion", icon: "message", badge: chatUnread || undefined },
    { k: "services", label: "Annuaire des services", icon: "grid" },
  ];
}

export function Sidebar({ space, screen, counts, collapsed, onToggle }) {
  const { user } = useAuth();
  const { totalUnread } = usePresence();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const sp = SPACE_META[space];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const goto = (k) => navigate(k ? `/${space}/${k}` : `/${space}`);
  const switchSpace = (key) => {
    const idx = spaceIndexScreen(key);
    navigate(idx ? `/${key}/${idx}` : `/${key}`);
    setOpen(false);
  };

  const spaces = allowedSpaces(user);
  const roleLabel = user?.role === "ADMIN"
    ? "Administrateur"
    : `${ROLE_LABELS.MEMBER}${user?.department ? " · " + user.department.name : ""}`;

  return (
    <aside className="sidebar" ref={ref}>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        title={collapsed ? "Déplier le menu" : "Réduire le menu"}
        aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
      >
        <Icon name={collapsed ? "chevRight" : "chevsLeft"} style={{ width: 16, height: 16 }} />
      </button>

      <button className="brand" onClick={() => setOpen((v) => !v)} title={collapsed ? `${sp.name} — changer d'espace` : "Changer d'espace"}>
        <span className="monogram">{sp.mono}</span>
        <span className="brand-meta">
          <span className="b-name">{space === "global" ? "Espace Global" : sp.mono}</span>
          <span className="b-sub">{space === "global" ? "Tous accès" : sp.name}</span>
        </span>
        <span className="chev"><Icon name="chevDown" style={{ width: 16, height: 16 }} /></span>
      </button>

      {open && (
        <div className="switcher fade-in">
          {spaces.map((key) => {
            const s = SPACE_META[key];
            return (
              <button key={key} className="switch-item" onClick={() => switchSpace(key)}>
                <span className="sw-dot" style={{ background: s.color, color: key === "idc" ? "#3c2c08" : "#fff" }}>{s.mono}</span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span className="sw-name">{key === "global" ? "Espace Global" : s.name}</span>
                  <span className="sw-sub">{s.sub}</span>
                </span>
                {key === space && <span className="sw-check"><Icon name="check" style={{ width: 18, height: 18 }} /></span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="nav-group-label">Navigation</div>
      {navItemsFor(space, counts, totalUnread).map((it) => (
        <button key={it.k || "home"} className={"nav-item" + (screen === it.k ? " active" : "")} onClick={() => goto(it.k)} title={collapsed ? it.label : undefined}>
          <Icon name={it.icon} />
          <span>{it.label}</span>
          {it.badge != null && <span className="nav-badge">{it.badge}</span>}
        </button>
      ))}

      <div className="sidebar-foot">
        <div className="user-card" title={collapsed ? `${user?.name} · ${roleLabel}` : undefined}>
          <Avatar name={user?.name} size={34} />
          <span className="u-meta">
            <span className="u-name">{user?.name}</span>
            <span className="u-role">{roleLabel}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
