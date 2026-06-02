import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Avatar } from "../components/Badges.jsx";
import { TeamManageModal } from "../components/TeamManageModal.jsx";
import { chatApi } from "../api/endpoints.js";
import { connectChat } from "../lib/socketChat.js";
import { useAuth } from "../context/AuthContext.jsx";

const msgTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function Chat() {
  const { space } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [canCreate, setCanCreate] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);

  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const listRef = useRef(null);

  const loadRooms = () =>
    chatApi.rooms().then(({ rooms, canCreateDeptRoom }) => {
      setRooms(rooms);
      setCanCreate(canCreateDeptRoom);
      setActiveId((cur) => cur || (rooms[0] && rooms[0].id) || null);
    }).catch((e) => setError(e.message));

  // Connexion socket + écouteurs (une fois).
  useEffect(() => {
    loadRooms();
    const s = connectChat();
    socketRef.current = s;
    s.on("chat:message", (m) => {
      if (m.roomId === activeRef.current) setMessages((prev) => [...prev, m]);
    });
    s.on("chat:deleted", ({ id, roomId }) => {
      if (roomId === activeRef.current) setMessages((prev) => prev.filter((x) => x.id !== id));
    });
    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  // Changement de salon : historique + join/leave.
  useEffect(() => {
    if (!activeId) return;
    const prev = activeRef.current;
    activeRef.current = activeId;
    const s = socketRef.current;
    if (s) {
      if (prev) s.emit("chat:leave", { roomId: prev });
      s.emit("chat:join", { roomId: activeId });
    }
    chatApi.messages(activeId).then(({ messages, canManage }) => {
      setMessages(messages);
      setCanManage(canManage);
    }).catch((e) => setError(e.message));
  }, [activeId]);

  // Auto-scroll en bas.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    const content = draft.trim();
    if (!content || !socketRef.current || !activeId) return;
    socketRef.current.emit("chat:send", { roomId: activeId, content });
    setDraft("");
  };

  const removeMsg = (id) => socketRef.current?.emit("chat:delete", { messageId: id });

  const createRoom = () =>
    chatApi.createRoom({}).then(({ room }) => { loadRooms(); setActiveId(room.id); }).catch((e) => setError(e.message));

  const renameRoom = (room) => {
    const name = window.prompt("Nouveau nom du salon :", room.name);
    if (name && name.trim()) chatApi.patchRoom(room.id, { name: name.trim() }).then(loadRooms).catch((e) => setError(e.message));
  };
  const toggleArchive = (room) =>
    chatApi.patchRoom(room.id, { archived: !room.archived }).then(loadRooms).catch((e) => setError(e.message));
  const deleteRoom = (room) => {
    if (!window.confirm(`Supprimer le salon « ${room.name} » et tous ses messages ? Cette action est irréversible.`)) return;
    chatApi.deleteRoom(room.id).then(() => { setActiveId(null); setMessages([]); loadRooms(); }).catch((e) => setError(e.message));
  };

  const toTicket = (m) => {
    const title = m.content.length > 70 ? m.content.slice(0, 70) + "…" : m.content;
    navigate(`/${space}/form?title=${encodeURIComponent(title)}&description=${encodeURIComponent(m.content)}`);
  };

  const active = rooms.find((r) => r.id === activeId);

  return (
    <div className="scroll">
      <div className="page" style={{ paddingBottom: 24 }}>
        <div className="page-head">
          <h1 className="page-title">Discussion</h1>
          <p className="page-sub">Salon général et salons de service, en temps réel.</p>
        </div>
        {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="chat-wrap">
          <aside className="chat-rooms">
            {rooms.map((r) => (
              <button key={r.id} className={"chat-room" + (r.id === activeId ? " active" : "")} onClick={() => setActiveId(r.id)}>
                <Icon name={r.scope === "GLOBAL" ? "users" : "message"} />
                <span className="cr-name">{r.name}{r.archived ? " (archivé)" : ""}</span>
              </button>
            ))}
            {canCreate && (
              <button className="chat-room create" onClick={createRoom}>
                <Icon name="plusCircle" /><span className="cr-name">Créer le salon de mon service</span>
              </button>
            )}
          </aside>

          <section className="chat-main">
            <div className="chat-head">
              <div style={{ fontWeight: 700 }}>{active ? active.name : "—"}</div>
              {active?.canManage && (
                <div className="row" style={{ gap: 6 }}>
                  {active.scope === "DEPARTMENT" && active.departmentId && (
                    <button className="btn btn-subtle btn-sm" onClick={() => setTeamOpen(true)}><Icon name="users" />Gérer l'équipe</button>
                  )}
                  <button className="btn btn-subtle btn-sm" onClick={() => renameRoom(active)}>Renommer</button>
                  <button className="btn btn-subtle btn-sm" onClick={() => toggleArchive(active)}>{active.archived ? "Désarchiver" : "Archiver"}</button>
                  {active.scope === "DEPARTMENT" && (
                    <button className="btn btn-danger btn-sm" onClick={() => deleteRoom(active)}>Supprimer</button>
                  )}
                </div>
              )}
            </div>

            <div className="chat-messages" ref={listRef}>
              {messages.length === 0 ? (
                <div className="empty"><Icon name="message" /><div>Aucun message. Lancez la conversation !</div></div>
              ) : messages.map((m) => {
                const mine = m.author?.id === user.id;
                return (
                  <div key={m.id} className={"chat-msg" + (mine ? " mine" : "")}>
                    <Avatar name={m.author?.name} size={30} />
                    <div className="cm-body">
                      <div className="cm-head"><span className="cm-name">{m.author?.name}</span><span className="cm-time">{msgTime(m.createdAt)}</span></div>
                      <div className="cm-bubble">{m.content}</div>
                      <div className="cm-actions">
                        <button onClick={() => toTicket(m)} title="Convertir en ticket"><Icon name="plusCircle" />Ticket</button>
                        {(mine || canManage) && <button onClick={() => removeMsg(m.id)} title="Supprimer"><Icon name="trash" />Suppr.</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {active && !active.archived && (
              <div className="chat-composer">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Écrire un message…"
                />
                <button className="btn btn-primary" onClick={send} disabled={!draft.trim()}><Icon name="send" /></button>
              </div>
            )}
          </section>
        </div>
      </div>

      {teamOpen && active?.departmentId && (
        <TeamManageModal
          departmentId={active.departmentId}
          deptName={active.name}
          onClose={() => setTeamOpen(false)}
          onChanged={loadRooms}
        />
      )}
    </div>
  );
}
