import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { notificationsApi } from "../api/endpoints.js";
import { useAuth } from "./AuthContext.jsx";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    notificationsApi
      .list()
      .then(({ notifications, unread }) => { setItems(notifications); setUnread(unread); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setItems([]); setUnread(0); return; }
    refresh();
    const t = setInterval(refresh, 20000); // sondage léger toutes les 20 s
    return () => clearInterval(t);
  }, [user, refresh]);

  const markAllRead = useCallback(async () => {
    setItems((x) => x.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await notificationsApi.readAll(); } catch { /* ignore */ }
  }, []);

  const markRead = useCallback(async (id) => {
    setItems((x) => x.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await notificationsApi.read(id); } catch { /* ignore */ }
  }, []);

  return (
    <NotificationsContext.Provider value={{ items, unread, refresh, markAllRead, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext) || { items: [], unread: 0, refresh: () => {}, markAllRead: () => {}, markRead: () => {} };
}
