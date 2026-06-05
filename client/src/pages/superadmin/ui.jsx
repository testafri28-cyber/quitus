// Petits éléments partagés du backoffice.
export function Badge({ meta }) {
  if (!meta) return null;
  return (
    <span
      className="sa-badge"
      style={{
        color: meta.color,
        borderColor: `color-mix(in srgb, ${meta.color} 38%, white)`,
        background: `color-mix(in srgb, ${meta.color} 11%, white)`,
      }}
    >
      <span className="sa-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function Loading() {
  return <div className="sa-empty">Chargement…</div>;
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return <div className="error-box" style={{ marginBottom: 16 }}>{message}</div>;
}
