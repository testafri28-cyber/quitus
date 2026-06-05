import { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon.jsx";
import { ServiceIcon } from "./Badges.jsx";
import { GROUPS, GROUP_META, groupOf } from "../lib/design.js";

export function groupsForSpace(space) {
  if (space === "wca") return ["Commun", "WCA"];
  if (space === "idc") return ["Commun", "IDC"];
  return GROUPS; // global, admin
}

// Sélecteur de service destinataire (departments : [{id,name,code,company}])
export function ServicePicker({ departments, value, onChange, space }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const sel = value ? departments.find((d) => d.id === value) : null;
  const groups = groupsForSpace(space);

  return (
    <div className={"picker" + (open ? " open" : "")} ref={ref}>
      <button type="button" className="picker-trigger" onClick={() => setOpen((v) => !v)}>
        {sel ? <ServiceIcon department={sel} accent /> : <span className="svc-ico"><Icon name="grid" /></span>}
        <span className="pt-label">
          {sel
            ? <><span className="pt-name">{sel.name}</span> <span className="pt-group">· {GROUP_META[groupOf(sel)].label}</span></>
            : <span className="pt-placeholder">Choisir un service destinataire…</span>}
        </span>
        <span className="chev"><Icon name="chevDown" style={{ width: 18, height: 18 }} /></span>
      </button>
      {open && (
        <div className="picker-panel fade-in">
          <div className="picker-search">
            <Icon name="search" />
            <input autoFocus placeholder="Filtrer les services…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {groups.map((g) => {
            const list = departments.filter((d) => groupOf(d) === g && d.name.toLowerCase().includes(q.toLowerCase()));
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="pick-group">{GROUP_META[g].label}</div>
                {list.map((d) => (
                  <button type="button" key={d.id} className={"pick-item" + (value === d.id ? " sel" : "")}
                          onClick={() => { onChange(d.id); setOpen(false); setQ(""); }}>
                    <ServiceIcon department={d} accent={value === d.id} />
                    <span className="pi-name">{d.name}</span>
                    {value === d.id && <span className="pi-check"><Icon name="check" style={{ width: 17, height: 17 }} /></span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filtre déroulant multi-sélection
export function FilterDropdown({ label, icon, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  // Position adaptative : ouvre vers le haut si peu de place dessous, aligne à droite
  // si le menu déborderait à droite (évite que des options sortent de l'écran).
  const [pos, setPos] = useState({ up: false, right: false });
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      setPos({
        up: below < 260 && r.top > below,                 // pas la place en bas → ouvrir en haut
        right: r.left + 210 > window.innerWidth,           // déborderait à droite → aligner à droite
      });
    }
    setOpen((v) => !v);
  };

  const count = selected.length;
  return (
    <div className="filter" ref={ref}>
      <button className={"filter-btn" + (count ? " active" : "")} onClick={toggle}>
        <Icon name={icon || "filter"} />
        {label}
        {count > 0 && <span className="fb-count">{count}</span>}
        <Icon name="chevDown" style={{ width: 14, height: 14 }} />
      </button>
      {open && (
        <div className={"filter-menu fade-in" + (pos.up ? " up" : "") + (pos.right ? " right" : "")}>
          {options.map((o) => (
            <button key={o.key} className={"filter-opt" + (selected.includes(o.key) ? " on" : "")} onClick={() => onToggle(o.key)}>
              <span className="fo-check"><Icon name="check" style={{ width: 12, height: 12 }} /></span>
              {o.render ? o.render() : <span>{o.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
