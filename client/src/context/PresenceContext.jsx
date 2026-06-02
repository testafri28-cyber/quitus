import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { connectChat } from "../lib/socketChat.js";
import { usersApi, chatApi } from "../api/endpoints.js";
import { useAuth } from "./AuthContext.jsx";
import { useNotifications } from "./NotificationsContext.jsx";

const PresenceContext = createContext(null);

// Connexion Socket.IO unique pour toute l'application :
//  - présence (en ligne / hors-ligne + statut déclaré)
//  - activité des salons (badges de messages non lus)
export function PresenceProvider({ children }) {
  const { user } = useAuth();
  const { refresh: refreshNotifs } = useNotifications();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [statuses, setStatuses] = useState(() => new Map()); // userId -> AVAILABLE | UNAVAILABLE | ON_LEAVE
  const [people, setPeople] = useState(() => new Map()); // userId -> nom (pour mentions @)
  const [unread, setUnread] = useState({}); // roomId -> nombre de messages non lus

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineIds(new Set());
      setStatuses(new Map());
      setUnread({});
      return;
    }

    // Statuts déclarés (présence en ligne calculée via socket) + annuaire des noms (mentions @).
    usersApi.presence()
      .then(({ presences }) => {
        setStatuses(new Map(presences.map((p) => [p.id, p.presence])));
        setPeople(new Map(presences.map((p) => [p.id, p.name])));
      })
      .catch(() => {});

    // Compteur de messages non lus par salon (persistant — survit aux actualisations / hors-ligne).
    chatApi.unread().then(({ counts }) => setUnread(counts || {})).catch(() => {});

    const s = connectChat();
    socketRef.current = s;
    setSocket(s);

    s.on("presence:snapshot", ({ online }) => setOnlineIds(new Set(online)));
    s.on("presence:online", ({ userId }) => setOnlineIds((prev) => new Set(prev).add(userId)));
    s.on("presence:offline", ({ userId }) => setOnlineIds((prev) => { const n = new Set(prev); n.delete(userId); return n; }));
    s.on("presence:status", ({ userId, presence }) => setStatuses((prev) => new Map(prev).set(userId, presence)));
    s.on("chat:activity", ({ roomId }) => setUnread((u) => ({ ...u, [roomId]: (u[roomId] || 0) + 1 })));
    s.on("chat:mention", () => refreshNotifs()); // mention → la cloche se met à jour tout de suite

    return () => { s.disconnect(); socketRef.current = null; setSocket(null); };
  }, [user, refreshNotifs]);

  const setMyPresence = useCallback((presence) => {
    if (!user) return;
    setStatuses((prev) => new Map(prev).set(user.id, presence)); // optimiste
    socketRef.current?.emit("presence:set", { presence });
  }, [user]);

  const clearRoomUnread = useCallback((roomId) => {
    if (!roomId) return;
    setUnread((u) => { if (!u[roomId]) return u; const c = { ...u }; delete c[roomId]; return c; });
    chatApi.markRoomRead(roomId).catch(() => {}); // avance le marqueur de lecture côté serveur
  }, []);

  // État affiché d'une personne : leave > unavailable > (online | offline).
  const presenceState = useCallback((userId) => {
    const st = statuses.get(userId) || "AVAILABLE";
    if (st === "ON_LEAVE") return "leave";
    if (st === "UNAVAILABLE") return "unavailable";
    return onlineIds.has(userId) ? "online" : "offline";
  }, [statuses, onlineIds]);

  const myPresence = (user && statuses.get(user.id)) || "AVAILABLE";
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <PresenceContext.Provider value={{ socket, onlineIds, presenceState, myPresence, setMyPresence, people, unread, totalUnread, clearRoomUnread }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext) || {
    socket: null, onlineIds: new Set(), presenceState: () => "offline",
    myPresence: "AVAILABLE", setMyPresence: () => {}, people: new Map(), unread: {}, totalUnread: 0, clearRoomUnread: () => {},
  };
}
