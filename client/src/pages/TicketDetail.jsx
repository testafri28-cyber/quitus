import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { TypeChip, UrgencyPill, StatusChip, EmitterBadge, Avatar, ServiceIcon } from "../components/Badges.jsx";
import { UserHistoryModal } from "../components/UserHistoryModal.jsx";
import { StatusStepper } from "../components/StatusStepper.jsx";
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
  const [searchParams] = useSearchParams();
  const commentsRef = useRef(null);
  const scrolledRef = useRef(false);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [draft, setDraft] = useState("");
  const [commentMode, setCommentMode] = useState("internal"); // 'internal' (note interne) | 'public' (message au demandeur)
  // Édition de la demande (par le demandeur, tant qu'elle n'est pas prise en main)
  const [editReq, setEditReq] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  // Édition d'un commentaire (par son auteur, dans les 15 min)
  const [editCid, setEditCid] = useState(null);
  const [editCdraft, setEditCdraft] = useState("");
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

  // Notification de commentaire → on déroule jusqu'à la section commentaires.
  useEffect(() => {
    if (scrolledRef.current || loading || !ticket) return;
    if (searchParams.get("focus") === "comments" && commentsRef.current) {
      scrolledRef.current = true;
      setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 90);
    }
  }, [loading, ticket, searchParams]);

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
    try { await fn(); if (ok) showToast(ok); load(); return true; }
    catch (e) { setActionError(e.message); return false; }
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
  const putOnHold = () => run(() => ticketsApi.setStatus(ticket.id, "ON_HOLD"), "Demande mise en attente — le demandeur peut compléter.");

  // En interne par défaut ; un membre du service peut choisir d'écrire AU demandeur (commentaire public, notifié).
  const isInternalComment = canAct && commentMode === "internal";
  const sendComment = () => {
    if (!draft.trim()) return;
    run(() => ticketsApi.comment(ticket.id, draft.trim(), isInternalComment), null).then(() => setDraft(""));
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

  // Le demandeur peut corriger sa demande tant qu'elle n'est pas prise en main.
  const canEditRequest = ticket.submittedById === user.id && ticket.status === "NEW" && !ticket.assignedToId;
  const startEdit = () => { setTitleDraft(ticket.title); setDescDraft(ticket.description); setEditReq(true); setActionError(""); };
  const saveEdit = () => {
    if (!titleDraft.trim() || !descDraft.trim()) { setActionError("Le titre et la description sont requis."); return; }
    run(() => ticketsApi.update(ticket.id, { title: titleDraft.trim(), description: descDraft.trim() }), "Demande mise à jour.")
      .then((ok) => { if (ok) setEditReq(false); });
  };

  // Fenêtre de modification/suppression d'un commentaire : 15 min après publication.
  const COMMENT_WINDOW = 15 * 60 * 1000;
  const canEditComment = (c) => c.author?.id === user.id && Date.now() - new Date(c.createdAt).getTime() < COMMENT_WINDOW;
  const canDeleteComment = (c) => user.role === "ADMIN" || canEditComment(c);
  const saveComment = (c) => {
    if (!editCdraft.trim()) return;
    run(() => ticketsApi.editComment(ticket.id, c.id, editCdraft.trim()), "Commentaire modifié.").then((ok) => { if (ok) setEditCid(null); });
  };
  const removeComment = (c) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    run(() => ticketsApi.deleteComment(ticket.id, c.id), "Commentaire supprimé.");
  };

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

            <div className="card card-pad stepper-card">
              <StatusStepper status={ticket.status} />
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
              <div className="spread" style={{ marginBottom: editReq ? 12 : 0 }}>
                <div className="section-label" style={{ margin: 0 }}>{ticket.leaveStart ? "Motif" : "Description"}</div>
                {canEditRequest && !editReq && (
                  <button className="btn btn-subtle btn-sm" onClick={startEdit}><Icon name="edit" />Modifier</button>
                )}
              </div>
              {editReq ? (
                <div style={{ marginTop: 12 }}>
                  <label className="label">Titre</label>
                  <input className="input" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
                  <label className="label" style={{ marginTop: 12 }}>Description</label>
                  <textarea className="textarea" style={{ minHeight: 110 }} value={descDraft} onChange={(e) => setDescDraft(e.target.value)} />
                  <div className="row" style={{ gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveEdit}><Icon name="check" />Enregistrer</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditReq(false)}>Annuler</button>
                  </div>
                  <div className="hint" style={{ marginTop: 8 }}>Modifiable tant que la demande n'est pas prise en main.</div>
                </div>
              ) : (
                <div className="desc-body" style={{ marginTop: 10 }}><p>{ticket.description}</p></div>
              )}
              {!editReq && (ticket.attachments?.length ? (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {ticket.attachments.map((a) => (
                    <div className="file-chip" key={a.id}>
                      <span className="fc-ico"><Icon name="paperclip" /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div className="fc-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                      </span>
                      <a className="btn btn-subtle btn-sm" href={`${BASE_URL}${a.url}`} target="_blank" rel="noreferrer">Télécharger</a>
                    </div>
                  ))}
                </div>
              ) : ticket.attachmentUrl ? (
                <div className="file-chip" style={{ marginTop: 8 }}>
                  <span className="fc-ico"><Icon name="paperclip" /></span>
                  <span style={{ flex: 1 }}><div className="fc-name">Pièce jointe</div><div className="fc-size mono">fichier</div></span>
                  <a className="btn btn-subtle btn-sm" href={`${BASE_URL}${ticket.attachmentUrl}`} target="_blank" rel="noreferrer">Télécharger</a>
                </div>
              ) : null)}
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

            <div className="card card-pad" id="comments" ref={commentsRef}>
              <div className="section-label">Commentaires</div>
              {canAct && (
                <>
                  <div className="seg comment-seg" style={{ marginBottom: 10 }}>
                    <button type="button" className={commentMode === "internal" ? "sel" : ""} onClick={() => setCommentMode("internal")}>
                      <Icon name="lock" style={{ width: 14, height: 14 }} />Note interne
                    </button>
                    <button type="button" className={commentMode === "public" ? "sel" : ""} onClick={() => setCommentMode("public")}>
                      <Icon name="send" style={{ width: 14, height: 14 }} />Message au demandeur
                    </button>
                  </div>
                  <div className="comment-note">
                    <Icon name={isInternalComment ? "lock" : "user"} />
                    {isInternalComment
                      ? "Visible uniquement par votre service — non transmis au demandeur."
                      : "Envoyé au demandeur, qui en sera notifié et pourra répondre."}
                  </div>
                </>
              )}
              {(!ticket.comments || ticket.comments.length === 0) && <div className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Aucun commentaire pour l'instant.</div>}
              {ticket.comments?.map((c) => (
                <div className="comment" key={c.id}>
                  <Avatar name={c.author?.name} />
                  <div className="c-body">
                    <div className="c-head">
                      <span className="c-name">{nameNode(c.author)}</span>
                      {c.isInternal && <span className="badge" style={{ padding: "1px 7px" }}>Interne</span>}
                      <span className="c-time">{formatDate(c.createdAt)}{c.editedAt ? " · modifié" : ""}</span>
                      {editCid !== c.id && (canEditComment(c) || canDeleteComment(c)) && (
                        <span className="c-actions">
                          {canEditComment(c) && (
                            <button className="c-act" title="Modifier" onClick={() => { setEditCid(c.id); setEditCdraft(c.content); }}>
                              <Icon name="edit" style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                          {canDeleteComment(c) && (
                            <button className="c-act" title="Supprimer" onClick={() => removeComment(c)}>
                              <Icon name="trash" style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    {editCid === c.id ? (
                      <div className="c-edit">
                        <textarea className="textarea" style={{ minHeight: 60 }} value={editCdraft} onChange={(e) => setEditCdraft(e.target.value)} />
                        <div className="row" style={{ gap: 8, marginTop: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveComment(c)} disabled={!editCdraft.trim()}>Enregistrer</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditCid(null)}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="c-bubble">{c.content}</div>
                    )}
                  </div>
                </div>
              ))}
              <div className="comment-box">
                <Avatar name={user.name} />
                <div className="cb-input">
                  <textarea className="textarea" style={{ minHeight: 70 }}
                    placeholder={!canAct ? "Ajouter un commentaire…" : isInternalComment ? "Note interne au service…" : "Écrire au demandeur (question, complément attendu…)"}
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
                  <>
                    <button className="btn btn-primary" style={{ width: "100%" }} onClick={advanceStatus}>
                      <Icon name="check" />{NEXT_LABEL[ticket.status]}
                    </button>
                    {ticket.status === "IN_PROGRESS" && (
                      <button className="btn btn-subtle" style={{ width: "100%", marginTop: 8 }} onClick={putOnHold}>
                        <Icon name="clock" />Mettre en attente du demandeur
                      </button>
                    )}
                  </>
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
                <div className="divider" />
                <button className="btn btn-subtle" style={{ width: "100%" }}
                  onClick={() => navigate(`/${space}/form?parentId=${ticket.id}&parentRef=${encodeURIComponent(ticket.reference)}`)}>
                  <Icon name="plusCircle" />Créer un besoin lié
                </button>
                <div className="hint" style={{ marginTop: 6 }}>Pour un complément bloquant : son temps d'attente n'impactera pas le délai de ce ticket.</div>
              </div>
            )}

            {(ticket.parent || ticket.children?.length > 0) && (
              <div className="card card-pad" style={{ marginBottom: 20 }}>
                <div className="section-label">Dépendances</div>
                {ticket.parent && (
                  <div className="dep-row">
                    <span className="dep-tag">débloque</span>
                    <button className="link-mono" onClick={() => navigate(`/${space}/tickets/${ticket.parent.id}`)}>{ticket.parent.reference}</button>
                    <span className="dep-title">{ticket.parent.title}</span>
                    <StatusChip status={ticket.parent.status} />
                  </div>
                )}
                {ticket.children?.map((c) => (
                  <div className="dep-row" key={c.id}>
                    <span className="dep-tag">besoin lié</span>
                    <button className="link-mono" onClick={() => navigate(`/${space}/tickets/${c.id}`)}>{c.reference}</button>
                    <span className="dep-title">{c.title}</span>
                    <StatusChip status={c.status} />
                  </div>
                ))}
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
