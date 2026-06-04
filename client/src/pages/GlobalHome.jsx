import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { TypeChip, UrgencyPill, StatusChip, EmitterBadge, ServiceIcon } from "../components/Badges.jsx";
import { departmentsApi, ticketsApi } from "../api/endpoints.js";
import { GROUPS, GROUP_META, groupOf, inkOn } from "../lib/design.js";
import { useBrand } from "../context/BrandContext.jsx";
import { groupColor } from "../lib/brand.js";

export default function GlobalHome() {
  const navigate = useNavigate();
  const { brand } = useBrand();
  const [departments, setDepartments] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch(() => {});
    ticketsApi.list({ pageSize: 100 }).then(({ tickets }) => setTickets(tickets)).catch(() => {});
  }, []);

  const open = tickets.filter((t) => t.status === "NEW" || t.status === "IN_PROGRESS").length;
  const cross = tickets.filter((t) => t.sourceSpace === "GLOBAL").length;
  const recent = tickets.slice(0, 4);

  return (
    <div className="scroll">
      <div className="page">
        <section className="hero">
          <div className="h-body">
            <div className="h-eyebrow">Plateforme commune · WCA × IDC</div>
            <h1 className="h-title">Une seule porte d'entrée<br />pour toutes vos demandes.</h1>
            <p className="h-sub">Adressez une intervention ou un besoin particulier à l'un des {departments.length || 21} services du bâtiment, qu'il relève du tronc commun, de WCA ou d'IDC.</p>
            <div className="h-actions">
              <button className="btn btn-primary btn-lg" onClick={() => navigate("/global/form")}><Icon name="plus" />Nouvelle demande</button>
              <button className="btn btn-ghost btn-lg" onClick={() => navigate("/global/dashboard")}><Icon name="inbox" />Suivre mes demandes</button>
            </div>
          </div>
          <div style={{ width: 128, height: 128, flexShrink: 0, display: "grid", placeItems: "center" }}>
            <div className="monogram lg" style={{ width: 96, height: 96, borderRadius: 24, fontSize: 30 }}>GL</div>
          </div>
        </section>

        <div className="stat-strip">
          <div className="kpi"><div className="k-val">{tickets.length}</div><div className="k-label">Demandes suivies</div></div>
          <div className="kpi"><div className="k-val">{open}</div><div className="k-label">En cours de traitement</div></div>
          <div className="kpi"><div className="k-val">{cross}</div><div className="k-label">Via l'espace global</div></div>
          <div className="kpi"><div className="k-val">{departments.length || 21}</div><div className="k-label">Services destinataires</div></div>
        </div>

        <h2 className="section-title">Accès rapide aux services</h2>
        <div className="group-grid" style={{ marginBottom: 32 }}>
          {GROUPS.map((g) => {
            const meta = GROUP_META[g];
            const list = departments.filter((d) => groupOf(d) === g);
            return (
              <div className="group-card" key={g}>
                <div className="gc-head">
                  <span className="gc-mono" style={{ background: groupColor(brand, g), color: inkOn(groupColor(brand, g)) }}>{meta.mono}</span>
                  <div><div className="gc-name">{meta.label}</div><div className="gc-count">{list.length} services · {meta.sub}</div></div>
                </div>
                <div className="gc-list">
                  {list.map((d) => (
                    <button key={d.id} className="svc-row" onClick={() => navigate(`/global/form?service=${d.id}`)}>
                      <ServiceIcon department={d} />
                      <span className="sr-name">{d.name}</span>
                      <span className="sr-arrow"><Icon name="arrowRight" style={{ width: 16, height: 16 }} /></span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="section-title">Activité récente</h2>
        <div className="card">
          {recent.map((t, i) => (
            <button key={t.id} className="t-row" style={{ gridTemplateColumns: "46px 1fr 150px 140px 120px", borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none" }}
              onClick={() => navigate(`/global/tickets/${t.id}`)}>
              <TypeChip type={t.type} />
              <div className="t-titlewrap">
                <div className="t-title">{t.title}</div>
                <div className="t-id mono">{t.reference} · {t.department?.name}</div>
              </div>
              <UrgencyPill urgency={t.urgency} />
              <StatusChip status={t.status} />
              <EmitterBadge company={t.sourceCompany} />
            </button>
          ))}
          {recent.length === 0 && <div className="empty"><Icon name="inbox" /><div>Aucune demande pour l'instant.</div></div>}
        </div>
      </div>
    </div>
  );
}
