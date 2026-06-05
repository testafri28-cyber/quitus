import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Avatar } from "../components/Badges.jsx";
import { TeamManageModal } from "../components/TeamManageModal.jsx";
import { CreateRoomModal } from "../components/CreateRoomModal.jsx";
import { chatApi, departmentsApi } from "../api/endpoints.js";
import { BASE_URL } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence } from "../context/PresenceContext.jsx";
import { useNotifications } from "../context/NotificationsContext.jsx";
import { PRESENCE_STATE_META, PRESENCE_OPTIONS } from "../lib/design.js";

const msgTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Détecte un « @mot » en cours de frappe juste avant le curseur (s'arrête à un espace).
function getMentionQuery(value, caret) {
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null; // « @ » en début de mot
  const frag = upto.slice(at + 1);
  if (/\s/.test(frag)) return null;
  return { at, caret, query: frag };
}

// Petite pastille de disponibilité.
function PresenceDot({ userId }) {
  const { presenceState } = usePresence();
  const st = presenceState(userId);
  const m = PRESENCE_STATE_META[st];
  return <span className="pres-dot" style={{ background: m.color }} title={m.label} />;
}

export default function Chat() {
  const { space } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket, presenceState, myPresence, setMyPresence, people, unread, clearRoomUnread } = usePresence();
  const { items: notifs, markRead } = useNotifications();

  const [rooms, setRooms] = useState([]);
  const [canCreate, setCanCreate] = useState(false);
  const [activeId, setActiveId] = useState(searchParams.get("room") || null);
  const [messages, setMessages] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null); // { url, name } une fois uploadé
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [departments, setDepartments] = useState([]);

  const isAdmin = user.role === "ADMIN";
  const activeRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Mentions @ : personnes citables du salon actif + état de l'autocomplétion.
  const [mentionables, setMentionables] = useState([]);
  const [mention, setMention] = useState(null); // { at, caret, query } | null
  const mentionIdsRef = useRef(new Set()); // ids sélectionnés dans le brouillon courant

  // Regex de surbrillance des @noms connus (longs noms d'abord).
  const mentionRe = useMemo(() => {
    const names = [...people.values()].filter(Boolean).sort((a, b) => b.length - a.length);
    if (!names.length) return null;
    return new RegExp("@(" + names.map(escapeRe).join("|") + ")", "g");
  }, [people]);

  const renderContent = (text) => {
    if (!mentionRe) return text;
    const out = [];
    let last = 0, m;
    mentionRe.lastIndex = 0;
    while ((m = mentionRe.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(<span key={m.index} className="mention">@{m[1]}</span>);
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const active = rooms.find((r) => r.id === activeId);

  const loadRooms = () =>
    chatApi.rooms().then(({ rooms, canCreateDeptRoom }) => {
      setRooms(rooms);
      setCanCreate(canCreateDeptRoom);
      setActiveId((cur) => cur || (rooms[0] && rooms[0].id) || null);
    }).catch((e) => setError(e.message));

  // Chargement initial (salons + services pour l'admin).
  useEffect(() => {
    loadRooms();
    if (isAdmin) departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch(() => {});
  }, []);

  // Écouteurs de messages sur le socket partagé.
  useEffect(() => {
    if (!socket) return;
    const onMsg = (m) => { if (m.roomId === activeRef.current) setMessages((prev) => [...prev, m]); };
    const onDel = ({ id, roomId }) => { if (roomId === activeRef.current) setMessages((prev) => prev.filter((x) => x.id !== id)); };
    socket.on("chat:message", onMsg);
    socket.on("chat:deleted", onDel);
    return () => { socket.off("chat:message", onMsg); socket.off("chat:deleted", onDel); };
  }, [socket]);

  // Rejoindre / quitter le salon actif (présence dans la salle socket).
  useEffect(() => {
    if (!socket || !activeId) return;
    socket.emit("chat:join", { roomId: activeId });
    return () => {
      socket.emit("chat:leave", { roomId: activeId });
      clearRoomUnread(activeId); // avance le marqueur de lecture en quittant le salon
    };
  }, [socket, activeId]);

  // Charger l'historique au changement de salon + remettre à zéro le compteur non-lus.
  useEffect(() => {
    if (!activeId) return;
    activeRef.current = activeId;
    clearRoomUnread(activeId);
    chatApi.messages(activeId).then(({ messages, canManage }) => {
      setMessages(messages);
      setCanManage(canManage);
    }).catch((e) => setError(e.message));
  }, [activeId]);

  // Auto-scroll en bas.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Ouvrir le salon où l'on est mentionné lève la mention : on marque ses notifications « @ » comme lues
  // (fait disparaître le « @ » de la barre latérale). Vaut aussi pour une mention reçue salon ouvert.
  useEffect(() => {
    if (!activeId) return;
    notifs.forEach((n) => {
      if (n.type === "mention" && !n.read && n.roomId === activeId) markRead(n.id);
    });
  }, [activeId, notifs, markRead]);

  // Personnes citables (@) du salon actif : membres du service, ou tout l'annuaire pour le global.
  useEffect(() => {
    setMention(null);
    mentionIdsRef.current = new Set();
    if (!active) { setMentionables([]); return; }
    if (active.scope === "DEPARTMENT" && active.departmentId) {
      departmentsApi.members(active.departmentId)
        .then(({ members }) => setMentionables(members.map((m) => ({ id: m.id, name: m.name }))))
        .catch(() => setMentionables([]));
    } else {
      setMentionables([...people.entries()].map(([id, name]) => ({ id, name })).filter((p) => p.id !== user.id));
    }
  }, [activeId, active?.scope, active?.departmentId, people]);

  // Candidats filtrés selon ce qui est tapé après « @ ».
  const mentionMatches = mention
    ? mentionables.filter((p) => p.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  const onDraftChange = (e) => {
    const value = e.target.value;
    setDraft(value);
    setMention(getMentionQuery(value, e.target.selectionStart ?? value.length));
  };

  const pickMention = (person) => {
    const m = mention;
    if (!m) return;
    const before = draft.slice(0, m.at);
    const after = draft.slice(m.caret);
    const insert = "@" + person.name + " ";
    const next = before + insert + after;
    mentionIdsRef.current.add(person.id);
    setDraft(next);
    setMention(null);
    const caret = (before + insert).length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(caret, caret); }
    });
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Fichier trop volumineux (10 Mo max)."); return; }
    setError(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url, name } = await chatApi.upload(fd);
      setAttachment({ url, name });
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  const send = () => {
    const content = draft.trim();
    if ((!content && !attachment) || !socket || !activeId) return;
    // Ne garder que les mentions dont le « @nom » est toujours présent dans le texte.
    const mentions = [...mentionIdsRef.current].filter((id) => {
      const name = people.get(id);
      return name && content.includes("@" + name);
    });
    socket.emit("chat:send", {
      roomId: activeId,
      content,
      mentions,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
    });
    setDraft("");
    setAttachment(null);
    setMention(null);
    mentionIdsRef.current = new Set();
  };

  const onComposerKeyDown = (e) => {
    if (mention && mentionMatches.length && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      pickMention(mentionMatches[0]);
      return;
    }
    if (mention && e.key === "Escape") { setMention(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const removeMsg = (id) => socket?.emit("chat:delete", { messageId: id });

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
    const base = m.content || m.attachmentName || "Demande issue d'une discussion";
    const title = base.length > 70 ? base.slice(0, 70) + "…" : base;
    const q = new URLSearchParams({ title, description: m.content || "" });
    if (m.attachmentUrl) { q.set("attachmentUrl", m.attachmentUrl); q.set("attachmentName", m.attachmentName || "fichier"); }
    navigate(`/${space}/form?${q.toString()}`);
  };

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
            <div className="chat-me">
              <span className="pres-dot" style={{ background: PRESENCE_STATE_META[presenceState(user.id)].color }} />
              <select className="pres-select" value={myPresence} onChange={(e) => setMyPresence(e.target.value)} title="Ma disponibilité">
                {PRESENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {rooms.map((r) => (
              <button key={r.id} className={"chat-room" + (r.id === activeId ? " active" : "")} onClick={() => setActiveId(r.id)}>
                <Icon name={r.scope === "GLOBAL" ? "users" : "message"} />
                <span className="cr-name">{r.name}{r.archived ? " (archivé)" : ""}</span>
                {unread[r.id] > 0 && r.id !== activeId && <span className="cr-badge">{unread[r.id] > 9 ? "9+" : unread[r.id]}</span>}
              </button>
            ))}
            {canCreate && (
              <button className="chat-room create" onClick={createRoom}>
                <Icon name="plusCircle" /><span className="cr-name">Créer le salon de mon service</span>
              </button>
            )}
            {isAdmin && (
              <button className="chat-room create" onClick={() => setCreateOpen(true)}>
                <Icon name="plusCircle" /><span className="cr-name">Créer un salon</span>
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
                  {(active.scope === "DEPARTMENT" || isAdmin) && (
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
                      <div className="cm-head">
                        {m.author?.id && <PresenceDot userId={m.author.id} />}
                        <span className="cm-name">{m.author?.name}</span>
                        <span className="cm-time">{msgTime(m.createdAt)}</span>
                      </div>
                      {m.content && <div className="cm-bubble">{renderContent(m.content)}</div>}
                      {m.attachmentUrl && (
                        <a className="cm-attach" href={BASE_URL + m.attachmentUrl} target="_blank" rel="noreferrer" title="Ouvrir / télécharger">
                          <span className="ca-ico"><Icon name="file" /></span>
                          <span className="ca-name">{m.attachmentName || "Pièce jointe"}</span>
                          <span className="ca-dl"><Icon name="arrowRight" /></span>
                        </a>
                      )}
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
              <div className="chat-composer-wrap">
                {(attachment || uploading) && (
                  <div className="chat-attach-pending">
                    <span className="ca-ico"><Icon name="file" /></span>
                    <span className="ca-name">{uploading ? "Envoi du fichier…" : attachment.name}</span>
                    {!uploading && <button className="icon-btn" title="Retirer" onClick={() => setAttachment(null)}><Icon name="x" /></button>}
                  </div>
                )}
                <div className="chat-composer">
                  {mention && mentionMatches.length > 0 && (
                    <div className="mention-menu">
                      {mentionMatches.map((p, i) => (
                        <button key={p.id} className={"mention-item" + (i === 0 ? " first" : "")} onMouseDown={(e) => { e.preventDefault(); pickMention(p); }}>
                          <Avatar name={p.name} size={24} />
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="icon-btn ca-btn" title="Joindre un fichier (10 Mo max)">
                    <Icon name="paperclip" />
                    <input type="file" style={{ display: "none" }} onChange={onPickFile} disabled={uploading} />
                  </label>
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={onDraftChange}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Écrire un message…  (tapez @ pour mentionner)"
                  />
                  <button className="btn btn-primary" onClick={send} disabled={(!draft.trim() && !attachment) || uploading}><Icon name="send" /></button>
                </div>
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

      {createOpen && (
        <CreateRoomModal
          roomlessDepts={departments.filter((d) => !rooms.some((r) => r.departmentId === d.id))}
          onClose={() => setCreateOpen(false)}
          onCreated={(room) => { setCreateOpen(false); loadRooms(); setActiveId(room.id); }}
        />
      )}
    </div>
  );
}
