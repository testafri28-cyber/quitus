import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ticketsApi } from "../api/endpoints.js";
import { TYPE_META, URGENCY_META, LEAVE_KINDS, formatDate } from "../lib/design.js";

const longDate = (s) => (s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const leaveDays = (a, b) => {
  if (!a || !b) return "—";
  const d = Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
  return `${d} jour${d > 1 ? "s" : ""}`;
};

export default function PrintDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    ticketsApi.get(id).then(({ ticket }) => setTicket(ticket)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="doc-screen"><div className="doc-sheet"><div className="error-box">{error}</div></div></div>;
  if (!ticket) return <div className="doc-screen"><div className="doc-sheet">Chargement…</div></div>;

  const isLeave = !!ticket.leaveStart;
  const co = ticket.sourceCompany;
  const docTitle = isLeave ? "Demande de congé" : "Fiche de demande";

  return (
    <div className="doc-screen">
      <div className="doc-toolbar">
        <button className="btn btn-subtle btn-sm" onClick={() => navigate(-1)}><Icon name="arrowLeft" />Retour</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="file" />Imprimer / Enregistrer en PDF</button>
      </div>

      <div className="doc-sheet">
        <div className="doc-head">
          <div className="doc-org">
            <span className="monogram" style={{ background: co?.color || "#111", color: co?.slug === "idc" ? "#3c2c08" : "#fff" }}>{co?.slug?.toUpperCase()}</span>
            <div>
              <div className="doc-org-name">{co?.name}</div>
              <div className="doc-org-sub">Plateforme commune WCA × IDC</div>
            </div>
          </div>
          <div className="doc-ref">
            <div className="mono">{ticket.reference}</div>
            <div>Émis le {formatDate(ticket.createdAt)}</div>
          </div>
        </div>

        <h1 className="doc-title">{docTitle}</h1>
        <p className="doc-subtitle">{ticket.title}</p>

        <div className="doc-grid">
          <div className="doc-cell"><div className="dc-k">Demandeur</div><div className="dc-v">{ticket.submitter?.name}</div></div>
          <div className="doc-cell"><div className="dc-k">Service destinataire</div><div className="dc-v">{ticket.department?.name}</div></div>

          {isLeave ? (
            <>
              <div className="doc-cell"><div className="dc-k">Type de congé</div><div className="dc-v">{LEAVE_KINDS[ticket.leaveKind] || "Congé"}</div></div>
              <div className="doc-cell"><div className="dc-k">Durée</div><div className="dc-v">{leaveDays(ticket.leaveStart, ticket.leaveEnd)}</div></div>
              <div className="doc-cell"><div className="dc-k">Date de début</div><div className="dc-v">{longDate(ticket.leaveStart)}</div></div>
              <div className="doc-cell"><div className="dc-k">Date de fin</div><div className="dc-v">{longDate(ticket.leaveEnd)}</div></div>
            </>
          ) : (
            <>
              <div className="doc-cell"><div className="dc-k">Type</div><div className="dc-v">{TYPE_META[ticket.type]?.label}</div></div>
              <div className="doc-cell"><div className="dc-k">Urgence</div><div className="dc-v">{URGENCY_META[ticket.urgency]?.label}</div></div>
            </>
          )}
          <div className="doc-cell full"><div className="dc-k">Entreprise émettrice</div><div className="dc-v">{co?.name}</div></div>
        </div>

        <div className="doc-section-t">{isLeave ? "Motif" : "Description de la demande"}</div>
        <div className="doc-desc">{ticket.description}</div>

        <div className="doc-signs">
          <div className="doc-sign">
            <div className="ds-role">Le demandeur</div>
            <div className="ds-hint">Date et signature</div>
            <div className="ds-line" />
          </div>
          <div className="doc-sign">
            <div className="ds-role">{isLeave ? "Responsable RH" : "Responsable du service"}</div>
            <div className="ds-hint">Avis · date · signature</div>
            <div className="ds-line" />
          </div>
          <div className="doc-sign">
            <div className="ds-role">Direction</div>
            <div className="ds-hint">Visa</div>
            <div className="ds-line" />
          </div>
        </div>

        <div className="doc-foot">Document généré depuis Quitus · {ticket.reference} · à imprimer, signer, puis re-déposer sur la demande.</div>
      </div>
    </div>
  );
}
