// Catégories du formulaire et routage vers les services (codes Department).
// `company: null` = service commun ; "wca"/"idc" = propre à une entreprise.

export const CATEGORIES = [
  // --- Services communs (toujours visibles) ---
  { label: "Problème informatique (PC, logiciel, accès, réseau)", service: "it", company: null },
  { label: "Demande web ou design", service: "design", company: null },
  { label: "Congés / contrat / question RH", service: "rh", company: null },
  { label: "Question ou litige juridique", service: "juridique", company: null },
  { label: "Note de frais / demande comptable", service: "finance", company: null },
  { label: "Demande à la direction", service: "direction", company: null },

  // --- Services WCA ---
  { label: "Finance & Administration WCA", service: "wca-daf", company: "wca" },
  { label: "Exploitation HCL", service: "wca-expl-hcl", company: "wca" },
  { label: "Exploitation Marchandises", service: "wca-expl-marchandises", company: "wca" },
  { label: "QHSE / Sécurité", service: "wca-qhse", company: "wca" },
  { label: "OBC", service: "wca-obc", company: "wca" },
  { label: "Logistique & Parc / Véhicules", service: "wca-log-parc", company: "wca" },
  { label: "Maintenance / Mécanique", service: "wca-maintenance", company: "wca" },

  // --- Services IDC ---
  { label: "Contrôle de Gestion", service: "idc-controle-gestion", company: "idc" },
  { label: "Trésorerie & Boutique", service: "idc-tresorerie", company: "idc" },
  { label: "Cartes TPE", service: "idc-tpe", company: "idc" },
  { label: "Réseau / Stations", service: "idc-reseau", company: "idc" },
  { label: "Développement Réseau", service: "idc-dev-reseau", company: "idc" },
  { label: "Gestion Stock", service: "idc-stock", company: "idc" },
  { label: "Commercial / Clients", service: "idc-commercial", company: "idc" },
  { label: "Marketing", service: "idc-marketing", company: "idc" },
];

const FALLBACK_SERVICE = "it"; // demande non reconnue → IT par défaut

export const SPACES = ["GLOBAL", "WCA", "IDC"];

// Retourne le code de service (Department.code) pour un libellé de catégorie.
export function resolveServiceCode(categoryLabel) {
  if (!categoryLabel) return FALLBACK_SERVICE;
  const match = CATEGORIES.find((c) => c.label === categoryLabel);
  return match ? match.service : FALLBACK_SERVICE;
}

// Une catégorie est-elle visible dans un espace donné ?
//  - GLOBAL : tous les services
//  - WCA    : services communs (company null) + services WCA
//  - IDC    : services communs + services IDC
export function categoryVisibleInSpace(category, space) {
  if (space === "GLOBAL") return true;
  if (category.company === null) return true; // commun
  return category.company === space.toLowerCase();
}

// Catégories proposées dans un espace.
export function categoriesForSpace(space) {
  return CATEGORIES.filter((c) => categoryVisibleInSpace(c, space));
}

// L'utilisateur a-t-il le droit de soumettre dans cet espace ?
//  - GLOBAL : tout le monde
//  - WCA/IDC : uniquement les membres de l'entreprise correspondante (admin = tous)
export function userCanUseSpace(user, space) {
  if (!SPACES.includes(space)) return false;
  if (space === "GLOBAL") return true;
  if (user.role === "ADMIN") return true;
  return user.company?.slug === space.toLowerCase();
}
