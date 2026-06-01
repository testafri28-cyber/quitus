import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { TypeChip, UrgencyPill, StatusChip, EmitterBadge, Avatar, ServiceIcon } from "../components/Badges.jsx";
import { UserHistoryModal } from "../components/UserHistoryModal.jsx";
import { ticketsApi, departmentsApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { BASE_URL } from "../api/client.js";
import {
  TYPE_META, STATUS_META, NEXT_STATUS, NEXT_LABEL, GROUP_META, groupOf, formatDate, LEAVE_KINDS,
  EVENT_META, eventSentence,
} from "../lib/design.js";

const leaveDate = (s) => (s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");

export default function TicketDetail() {
  const { space, id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [draft, setDraft] = useState("");
  const [members, setMembers] = useState([]);
  const [transferTo, setTransferTo] = useState("");
  const [allDepts, setAllDepts] = useState([]);
  const [events, setEvents] = useState([]);
  const [histUser, setHistUser] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    ticketsApi.get(id).then(({ ticket }) => setTicket(ticket)).catch((e) => setError(e.message)).finally(() => setLoading(false));
    ticketsApi.events(id).then(({ events }) => setEvents(events)).catch(() => {});
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Membres du service (pour le transfert), si l'utilisateur peut agir.
  useEffect(() => {
    if (!ticket) return;
    const can = user.role === "ADMIN" || ticket.department?.id === user.departmentId;
    if (can && ticket.department?.id) {
      departmentsApi.members(ticket.department.id).then(({ members }) => setMembers(members)).catch(() => {});
    }
    if (user.role === "ADMIN" && allDepts.length === 0) {
      departmentsApi.list().then(({ departments }) => setAllDepts(departments)).catch(() => {});
    }
  }, [ticket, user]);

  async function run(fn, ok) {
    setActionError("");
    try { await fn(); if (ok) showToast(ok); load(); }
    catch (e) { setActionError(e.message); }
  }

  if (loading) return <div className="scroll"><div className="page"><div className="empty">Chargement…</div></div></div>;
  if (error) return <div className="scroll"><div className="page"><div className="error-box">{error}</div></div></div>;
  if (!ticket) return null;

  // Membre du service (baseline : voir, commenter), assigné, admin.
  const isServiceMember = ticket.department?.id === user.departmentId;
  const canAct = user.role === "ADMIN" || isServiceMember;
  const isClosed = ticket.status === "CLOSED";
  const isAssignee = ticket.assignedToId === user.id;
  const canTake = isServiceMember && !ticket.assignedToId && !isClosed; // prendre une demande libre
  const canChangeStatus = (user.role === "ADMIN" || isAssignee) && !isClosed; // seul l'assigné/admin avance le statut
  // L'admin peut cliquer un nom pour voir l'historique de ce membre.
  const nameNode = (u) => (user.role === "ADMIN" && u?.id
    ? <button className="link-name" onClick={() => setHistUser(u)}>{u.name}</button>
    : (u?.name || ""));
  const next = NEXT_STATUS[ticket.status];
  const svc = ticket.department;

  const takeTicket = () => run(() => ticketsApi.assign(ticket.id, { assignedToId: user.id }), "Vous avez pris la demande en main.");
  const advanceStatus = () => run(() => ticketsApi.setStatus(ticket.id, next), `Statut mis à jour : ${STATUS_META[next].label}.`);

  const sendComment = () => {
    if (!draft.trim()) return;
    run(() => ticketsApi.comment(ticket.id, draft.trim(), canAct), null).then(() => setDraft(""));
  };

  const uploadDoc = (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    run(() => ticketsApi.uploadDocument(ticket.id, fd), "Document ajouté à la demande.");
  };

  const proposeTransfer = () => {
    if (!transferTo) return;
    run(() => ticketsApi.transfer(ticket.id, transferTo), "Transfert proposé au collègue.");
    setTransferTo("");
  };
  const cancelTransfer = () => run(() => ticketsApi.transfer(ticket.id, null), "Transfert annulé.");
  const respondTransfer = (accept) => run(() => ticketsApi.respondTransfer(ticket.id, accept), accept ? "Transfert accepté." : "Transfert refusé.");

  const canFeedback = ticket.submittedById === user.id && (ticket.status === "RESOLVED" || ticket.status === "CLOSED") && !ticket.feedback;

  return (
    <div className="scroll">
      <div className="page">
        <button className="back-link" onClick={() => navigate(`/${space}/dashboard`)}><Icon name="arrowLeft" />Retour à la file</button>

        <div className="detail">
          <div>
            <div className="detail-head">
              <TypeChip type={ticket.type} />
              <div style={{ flex: 1 }}>
                <h1 className="dh-title">{ticket.title}</h1>
                <div className="dh-id mono">{ticket.reference} · {TYPE_META[ticket.type].label} · créé le {formatDate(ticket.createdAt)}</div>
              </div>
            </div>

            <div className="meta-grid">
              <div className="meta-cell">
                <div className="mc-label">Service destinataire</div>
                <div className="row"><ServiceIcon department={svc} accent /><div><div style={{ fontWeight: 600, fontSize: 14 }}>{svc?.name}</div><div className="muted" style={{ fontSize: 12.5 }}>{GROUP_META[groupOf(svc)].label}</div></div></div>
              </div>
              <div className="meta-cell">
                <div className="mc-label">Entreprise émettrice</div>
                <div style={{ marginTop: 2 }}><EmitterBadge company={ticket.sourceCompany} /></div>
              </div>
              <div className="meta-cell">
                <div className="mc-label">Urgence</div>
                <div style={{ marginTop: 2 }}><UrgencyPill urgency={ticket.urgency} /></div>
              </div>
              <div className="meta-cell">
                <div className="mc-label">Statut</div>
                <div style={{ marginTop: 2 }}><StatusChip status={ticket.status} /></div>
              </div>
              {ticket.suggestedTo && (
                <div className="meta-cell" style={{ gridColumn: "1 / -1" }}>
                  <div className="mc-label">Suggéré pour</div>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar name={ticket.suggestedTo.name} size={24} />
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {ticket.suggestedTo.name}{ticket.suggestedTo.id === user.id ? " (vous)" : ""}
                    </span>
                    <span className="muted" style={{ fontSize: 12.5 }}>· indication du demandeur</span>
                  </div>
                </div>
              )}
            </div>

            {ticket.leaveStart && (
              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <div className="section-label">Demande de congé</div>
                <div className="row" style={{ gap: 12 }}>
                  <span className="svc-ico accent"><Icon name="calendar" /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{LEAVE_KINDS[ticket.leaveKind] || "Congé"}</div>
                    <div className="muted" style={{ fontSize: 13.5 }}>Du {leaveDate(ticket.leaveStart)} au {leaveDate(ticket.leaveEnd)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="card card-pad" style={{ marginBottom: 22 }}>
              <div className="section-label">{ticket.leaveStart ? "Motif" : "Description"}</div>
              <div className="desc-body"><p>{ticket.description}</p></div>
              {ticket.attachmentUrl && (
                <div className="file-chip" style={{ marginTop: 8 }}>
                  <span className="fc-ico"><Icon name="paperclip" /></span>
                  <span style={{ flex: 1 }}><div className="fc-name">Pièce jointe</div><div className="fc-size mono">fichier</div></span>
                  <a className="btn btn-subtle btn-sm" href={`${BASE_URL}${ticket.attachmentUrl}`} target="_blank" rel="noreferrer">Télécharger</a>
                </div>
              )}
            </div>

            <div className="card card-pad" style={{ marginBottom: 22 }}>
              <div className="spread" style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ margin: 0 }}>Documents</div>
                <button className="btn btn-subtle btn-sm" onClick={() => navigate(`/document/${ticket.id}`)}>
                  <Icon name="file" />Générer le document à imprimer
                </button>
              </div>
              {ticket.documents?.length ? (
                ticket.documents.map((d) => (
                  <div className="doc-row" key={d.id}>
                    <span className="dr-ico"><Icon name="paperclip" /></span>
                    <span style={{ flex: 1 }}>
                      <div className="dr-name">{d.name}</div>
                      <div className="dr-meta">Ajouté par {d.uploadedBy?.name} · {formatDate(d.createdAt)}</div>
                    </span>
                    <a className="btn btn-subtle btn-sm" href={`${BASE_URL}${d.url}`} target="_blank" rel="noreferrer">Télécharger</a>
                  </div>
                ))
              ) : (
                <div className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
                  Aucun document déposé. Générez le formulaire, faites-le signer, puis déposez-le ici.
                </div>
              )}
              <label className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}>
                <Icon name="upload" />Déposer un document signé
                <input type="file" style={{ display: "none" }} onChange={(e) => { uploadDoc(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>

            {actionError && <div className="error-box" style={{ marginBottom: 16 }}>{actionError}</div>}

            <div className="card card-pad">
              <div className="section-label">Commentaires {canAct ? "internes" : ""}</div>
              {canAct && <div className="comment-note"><Icon name="lock" />Les commentaires internes ne sont pas transmis au demandeur.</div>}
              {(!ticket.comments || ticket.comments.length === 0) && <div className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Aucun commentaire pour l'instant.</div>}
              {ticket.comments?.map((c) => (
                <div className="comment" key={c.id}>
                  <Avatar name={c.author?.name} />
                  <div className="c-body">
                    <div className="c-head">
                      <span className="c-name">{nameNode(c.author)}</span>
                      {c.isInternal && <span className="badge" style={{ padding: "1px 7px" }}>Interne</span>}
                      <span className="c-time">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="c-bubble">{c.content}</div>
                  </div>
                </div>
              ))}
              <div className="comment-box">
                <Avatar name={user.name} />
                <div className="cb-input">
                  <textarea className="textarea" style={{ minHeight: 70 }}
                    placeholder={canAct ? "Ajouter un commentaire interne…" : "Ajouter un commentaire…"}
                    value={draft} onChange={(e) => setDraft(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={sendComment} disabled={!draft.trim()}><Icon name="send" /></button>
              </div>
            </div>
          </div>

          <div>
            {canAct && !isClosed && (
              <div className="card card-pad" style={{ marginBottom: 20 }}>
                <div className="section-label">Action</div>
                {canTake ? (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={takeTicket}>
                    <Icon name="user" />Prendre la main
                  </button>
                ) : canChangeStatus && next ? (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={advanceStatus}>
                    <Icon name="check" />{NEXT_LABEL[ticket.status]}
                  </button>
                ) : (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {ticket.assignee ? `Pris en charge par ${ticket.assignee.name}.` : "Demande non assignée."}
                  </div>
                )}
                <div className="divider" />
                <div className="spread">
                  <span className="muted" style={{ fontSize: 13 }}>Assigné à</span>
                  {ticket.assignee
                    ? <div className="row" style={{ gap: 8 }}><Avatar name={ticket.assignee.name} size={26} /><span style={{ fontSize: 13.5, fontWeight: 600 }}>{nameNode(ticket.assignee)}</span></div>
                    : <span className="badge">Non assigné</span>}
                </div>
              </div>
            )}

            {user.role === "ADMIN" && !isClosed && (
              <div className="card card-pad" style={{ marginBottom: 20 }}>
                <div className="section-label">Affectation (admin)</div>
                <label className="label">Service destinataire</label>
                <select className="select" value={ticket.department?.id || ""}
                  onChange={(e) => run(() => ticketsApi.assign(ticket.id, { departmentId: e.target.value }), "Service réaffecté.")}>
                  {allDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : " (commun)"}</option>
                  ))}
                </select>
                <label className="label" style={{ marginTop: 12 }}>Assigner à un membre</label>
                <select className="select" value={ticket.assignedToId || ""}
                  onChange={(e) => run(() => ticketsApi.assign(ticket.id, { assignedToId: e.target.value || null }), "Assignation mise à jour.")}>
                  <option value="">— Non assigné —</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="hint">Réaffecter à un autre service réinitialise l'assignation.</div>
              </div>
            )}

            {(() => {
              const isTarget = ticket.transferTo && ticket.transferTo.id === user.id;
              const amAssignee = ticket.assignedToId === user.id;
              const pending = !!ticket.transferTo;
              const show = !isClosed && (isTarget || ((amAssignee || user.role === "ADMIN") && ticket.assignee));
              if (!show) return null;
              return (
                <div className="card card-pad" style={{ marginBottom: 20 }}>
                  <div className="section-label">Transfert</div>
                  {pending ? (
                    isTarget ? (
                      <>
                        <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Un collègue souhaite vous confier ce ticket.</p>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => respondTransfer(true)}><Icon name="check" />Accepter</button>
                          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => respondTransfer(false)}>Refuser</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Proposé à <b>{ticket.transferTo.name}</b> — en attente d'acceptation.</p>
                        <button className="btn btn-subtle btn-sm" onClick={cancelTransfer}>Annuler le transfert</button>
                      </>
                    )
                  ) : (
                    <>
                      <label className="label">Transférer à un collègue du service</label>
                      <select className="select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                        <option value="">— Choisir un collègue —</option>
                        {members.filter((m) => m.id !== ticket.assignedToId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} disabled={!transferTo} onClick={proposeTransfer}>
                        <Icon name="send" />Proposer le transfert
                      </button>
                      <div className="hint">Le collègue devra accepter pour devenir responsable.</div>
                    </>
                  )}
                </div>
              );
            })()}

            {(ticket.feedback || canFeedback) && (
              <FeedbackCard ticket={ticket} canFeedback={canFeedback} onDone={load} setErr={setActionError} />
            )}

            <div className="card card-pad">
              <div className="section-label">Historique</div>
              <div className="timeline">
                {events.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13.5 }}>Aucun évènement enregistré.</div>
                ) : (
                  events.map((e) => {
                    const m = EVENT_META[e.action] || {};
                    return (
                      <div className="tl-item" key={e.id}>
                        <span className={"tl-dot" + (m.accent ? " accent" : "")}><Icon name={m.icon || "clock"} /></span>
                        <div className="tl-body">
                          <div className="tl-text"><b>{e.actor?.name || "Système"}</b> {eventSentence(e.action, e.detail)}</div>
                          <div className="tl-time">{formatDate(e.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {histUser && <UserHistoryModal user={histUser} space={space} onClose={() => setHistUser(null)} />}
    </div>
  );
}

function FeedbackCard({ ticket, canFeedback, onDone, setErr }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  if (ticket.feedback) {
    return (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-label">Satisfaction</div>
        <div className="row" style={{ gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Icon key={n} name="star" style={{ width: 20, height: 20, color: n <= ticket.feedback.rating ? "#d39a3c" : "var(--border-strong)", fill: n <= ticket.feedback.rating ? "#d39a3c" : "none" }} />
          ))}
        </div>
        {ticket.feedback.comment && <p className="muted" style={{ fontSize: 13.5, marginTop: 10 }}>« {ticket.feedback.comment} »</p>}
      </div>
    );
  }
  if (!canFeedback) return null;

  const submit = async () => {
    if (!rating) { setErr("Choisissez une note."); return; }
    try {
      await ticketsApi.feedback(ticket.id, rating, comment);
      onDone();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="section-label">Votre avis</div>
      <div className="row" style={{ gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} title={`${n}/5`}>
            <Icon name="star" style={{ width: 24, height: 24, color: n <= rating ? "#d39a3c" : "var(--border-strong)", fill: n <= rating ? "#d39a3c" : "none" }} />
          </button>
        ))}
      </div>
      <textarea className="textarea" style={{ minHeight: 60 }} placeholder="Un commentaire (optionnel)…" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 10 }} onClick={submit}>Envoyer mon avis</button>
    </div>
  );
}
