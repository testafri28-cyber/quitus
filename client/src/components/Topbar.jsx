import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { NotificationPrefsModal } from "./NotificationPrefsModal.jsx";
import { SPACE_META } from "../lib/spaces.js";

const NOTIF_ICON = {
  new_ticket: "inbox",
  suggested: "user",
  assigned: "check",
  status: "refresh",
  comment: "message",
  transfer_proposed: "send",
  transfer_accepted: "check",
  transfer_refused: "x",
};

function relTime(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function Topbar({ space, crumbs }) {
  const sp = SPACE_META[space];
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { items, unread, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const openNotif = (n) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    if (n.ticketId) navigate(`/${space}/tickets/${n.ticketId}`);
  };

  return (
    <header className="topbar">
      <nav className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <Icon name="chevRight" />}
            <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
          </span>
        ))}
      </nav>
      <div className="topbar-spacer" />
      <button className="icon-btn" title="Rechercher"><Icon name="search" /></button>

      <div className="notif" ref={ref}>
        <button className="icon-btn" title="Notifications" onClick={() => setOpen((v) => !v)}>
          <Icon name="bell" />
          {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
        </button>
        {open && (
          <div className="notif-panel fade-in">
            <div className="notif-head">
              <span>Notifications</span>
              {unread > 0 && <button className="notif-readall" onClick={markAllRead}>Tout marquer comme lu</button>}
            </div>
            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty"><Icon name="bell" /><div>Aucune notification</div></div>
              ) : (
                items.map((n) => (
                  <button key={n.id} className={"notif-item" + (n.read ? "" : " unread")} onClick={() => openNotif(n)}>
                    <span className="ni-ico"><Icon name={NOTIF_ICON[n.type] || "bell"} /></span>
                    <span className="ni-body">
                      <span className="ni-text">{n.text}</span>
                      <span className="ni-time">{n.ticket ? `${n.ticket.reference} · ` : ""}{relTime(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="ni-unread" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <button className="icon-btn" title="Préférences de notification" onClick={() => setPrefsOpen(true)}>
        <Icon name="sliders" />
      </button>

      <span className="company-badge">
        <span className="cb-dot">{sp.mono}</span>
        {space === "global" ? "Espace Global" : sp.mono}
      </span>
      <button className="icon-btn" title="Déconnexion" onClick={() => { logout(); navigate("/login"); }}>
        <Icon name="logout" />
      </button>

      {prefsOpen && <NotificationPrefsModal onClose={() => setPrefsOpen(false)} />}
    </header>
  );
}
