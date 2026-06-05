// Logo éditeur Quitus : anneau (violet interactif) + coche (vert « validé »).
export function QuitusMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Quitus">
      <circle cx="37" cy="48" r="26" fill="none" stroke="var(--qa-brand-interactive, #6359C4)" strokeWidth="9" />
      <polyline points="47,58 61,74 81,40" fill="none" stroke="var(--qa-accent, #1D9E75)"
        strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
