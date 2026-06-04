// Logo Quitus (cercle + coche). Hérite de la couleur via currentColor.
export function QuitusMark({ size = 30, className, title = "Quitus" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="37" cy="48" r="26" />
      <polyline points="47,58 61,74 81,40" />
    </svg>
  );
}
