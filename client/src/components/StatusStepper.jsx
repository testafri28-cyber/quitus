import { STATUS_META } from "../lib/design.js";

// Chemin principal du cycle de vie (ON_HOLD est un état temporaire sur « En cours »).
const STEPS = [
  { key: "NEW", cls: "nouveau" },
  { key: "IN_PROGRESS", cls: "encours" },
  { key: "RESOLVED", cls: "resolu" },
  { key: "CLOSED", cls: "cloture" },
];

const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Pause = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);

// Fil d'avancement du statut d'une demande.
export function StatusStepper({ status }) {
  const onHold = status === "ON_HOLD";
  const curKey = onHold ? "IN_PROGRESS" : status;
  const curIdx = Math.max(0, STEPS.findIndex((s) => s.key === curKey));

  return (
    <div className="stepper" role="list" aria-label="Avancement de la demande">
      {STEPS.map((s, i) => {
        const done = i < curIdx;
        const active = i === curIdx;
        const paused = active && onHold;
        const label = paused ? STATUS_META.ON_HOLD.label : STATUS_META[s.key].label;
        return (
          <div className={"step" + (done ? " done" : "") + (active ? " active" : "") + (paused ? " paused" : "")}
               key={s.key} role="listitem" aria-current={active ? "step" : undefined}>
            <span className="step-dot">
              {done ? <Check /> : paused ? <Pause /> : <span className="step-num">{i + 1}</span>}
            </span>
            <span className="step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
