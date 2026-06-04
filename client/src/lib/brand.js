import { inkOn } from "./design.js";

// Couleurs de marque par défaut (alignées sur le design system).
export const BRAND_DEFAULTS = { accent: "#6e62b6", accentWca: "#378add", accentIdc: "#ef9f27" };

// Injecte (ou met à jour) une feuille de style qui surcharge l'accent par espace,
// appliquée après le CSS de base → re-thématise toute l'app ET la page de connexion (:root).
export function applyBrand(brand) {
  const b = { ...BRAND_DEFAULTS, ...(brand || {}) };
  const css = `
:root { --accent: ${b.accent}; --accent-ink: ${inkOn(b.accent)}; }
.app[data-space="global"] { --accent: ${b.accent}; --accent-ink: ${inkOn(b.accent)}; }
.app[data-space="admin"]  { --accent: ${b.accent}; --accent-ink: ${inkOn(b.accent)}; }
.app[data-space="wca"]    { --accent: ${b.accentWca}; --accent-ink: ${inkOn(b.accentWca)}; }
.app[data-space="idc"]    { --accent: ${b.accentIdc}; --accent-ink: ${inkOn(b.accentIdc)}; }
`;
  let tag = document.getElementById("brand-theme");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "brand-theme";
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}
