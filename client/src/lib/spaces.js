// Espaces accessibles selon le rôle / l'entreprise, et navigation.
import { SPACE_META } from "./design.js";

export { SPACE_META };
export const SPACE_KEYS = ["global", "wca", "idc", "admin"];

export function allowedSpaces(user) {
  if (!user) return [];
  if (user.role === "ADMIN") return ["admin", "global", "wca", "idc"];
  const own = user.company?.slug; // tout membre : son espace entreprise + le global
  return own ? [own, "global"] : ["global"];
}

export function canUseSpace(user, space) {
  return allowedSpaces(user).includes(space);
}

// Espace d'accueil par défaut selon le rôle.
export function homeSpace(user) {
  if (!user) return "global";
  if (user.role === "ADMIN") return "admin";
  return user.company?.slug || "global"; // un membre arrive sur l'espace de son entreprise
}

// Premier écran d'un espace.
export function spaceIndexScreen(space) {
  return space === "global" ? "" : "dashboard"; // global → accueil (index)
}

export function homePathFor(user) {
  const sp = homeSpace(user);
  const screen = spaceIndexScreen(sp);
  return screen ? `/${sp}/${screen}` : `/${sp}`;
}
