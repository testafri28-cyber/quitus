import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ServiceIcon } from "../components/Badges.jsx";
import { groupsForSpace } from "../components/Controls.jsx";
import { departmentsApi } from "../api/endpoints.js";
import { GROUP_META, groupOf } from "../lib/design.js";

export default function ServicesAnnuaire() {
  const { space } = useParams();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    departmentsApi.list().then(({ departments }) => setDepartments(departments)).catch(() => {});
  }, []);

  const groups = groupsForSpace(space);

  return (
    <div className="scroll">
      <div className="page">
        <div className="page-head">
          <h1 className="page-title">Annuaire des services</h1>
          <p className="page-sub">Sélectionnez un service pour lui adresser directement une demande.</p>
        </div>

        <div className="group-grid">
          {groups.map((g) => {
            const meta = GROUP_META[g];
            const list = departments.filter((d) => groupOf(d) === g);
            if (!list.length) return null;
            return (
              <div className="group-card" key={g}>
                <div className="gc-head">
                  <span className="gc-mono" style={{ background: meta.color, color: g === "IDC" ? "#3c2c08" : "#fff" }}>{meta.mono}</span>
                  <div><div className="gc-name">{meta.label}</div><div className="gc-count">{list.length} services</div></div>
                </div>
                <div className="gc-list">
                  {list.map((d) => (
                    <button key={d.id} className="svc-row" onClick={() => navigate(`/${space}/form?service=${d.id}`)}>
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
      </div>
    </div>
  );
}
