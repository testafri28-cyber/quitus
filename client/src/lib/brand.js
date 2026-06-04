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

// Couleur de marque d'un espace (pour les éléments stylés en JS : pastilles du sélecteur d'espace…).
export function spaceColor(brand, key) {
  const b = { ...BRAND_DEFAULTS, ...(brand || {}) };
  if (key === "wca") return b.accentWca;
  if (key === "idc") return b.accentIdc;
  if (key === "admin") return "#5e6b7d"; // l'administration n'est pas une entreprise
  return b.accent; // global
}

// Couleur d'un groupe de services (Commun / WCA / IDC) sur l'accueil global.
export function groupColor(brand, group) {
  const b = { ...BRAND_DEFAULTS, ...(brand || {}) };
  if (group === "WCA") return b.accentWca;
  if (group === "IDC") return b.accentIdc;
  return b.accent; // Commun
}
