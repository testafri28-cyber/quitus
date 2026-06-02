// Règles d'accès aux salons de discussion.
// room doit inclure `department` (pour le responsable) quand on teste la gestion.

export function canAccessRoom(user, room) {
  if (room.scope === "GLOBAL") return true;
  if (user.role === "ADMIN") return true;
  return !!room.departmentId && room.departmentId === user.departmentId;
}

export function canManageRoom(user, room) {
  if (user.role === "ADMIN") return true;
  return room.scope === "DEPARTMENT" && room.department?.responsibleId === user.id;
}
