// Appels API regroupés par domaine.
import { api } from "./client.js";

export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
  changePassword: (currentPassword, newPassword) => api.patch("/auth/password", { currentPassword, newPassword }),
};

export const ticketsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return api.get(`/tickets${qs ? `?${qs}` : ""}`);
  },
  get: (id) => api.get(`/tickets/${id}`),
  update: (id, payload) => api.patch(`/tickets/${id}`, payload),
  create: (formData) => api.postForm("/tickets", formData),
  createLeave: (payload) => api.post("/tickets", payload),
  setStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  assign: (id, payload) => api.patch(`/tickets/${id}/assign`, payload),
  // Routage : boîte de tri (modérateurs) + file de validation (responsables)
  aTrier: () => api.get("/tickets/a-trier"),
  aValider: () => api.get("/tickets/a-valider"),
  trier: (id, departmentId) => api.patch(`/tickets/${id}/trier`, departmentId ? { departmentId } : {}),
  valider: (id, accept, motif) => api.patch(`/tickets/${id}/valider`, { accept, motif }),
  transfer: (id, toUserId) => api.patch(`/tickets/${id}/transfer`, { toUserId }),
  respondTransfer: (id, accept) => api.patch(`/tickets/${id}/transfer/respond`, { accept }),
  comment: (id, content, isInternal = false) =>
    api.post(`/tickets/${id}/comments`, { content, isInternal }),
  editComment: (id, commentId, content) => api.patch(`/tickets/${id}/comments/${commentId}`, { content }),
  deleteComment: (id, commentId) => api.del(`/tickets/${id}/comments/${commentId}`),
  uploadDocument: (id, formData) => api.postForm(`/tickets/${id}/documents`, formData),
  feedback: (id, rating, comment) => api.post(`/tickets/${id}/feedback`, { rating, comment }),
  events: (id) => api.get(`/tickets/${id}/events`),
};

export const auditApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
    return api.get(`/audit${qs ? `?${qs}` : ""}`);
  },
};

export const departmentsApi = {
  list: () => api.get("/departments"),
  companies: () => api.get("/departments/companies"),
  createCompany: (payload) => api.post("/departments/companies", payload),
  members: (id) => api.get(`/departments/${id}/members`),
  candidates: (id) => api.get(`/departments/${id}/candidates`),
  addMember: (id, userId) => api.post(`/departments/${id}/members`, { userId }),
  removeMember: (id, userId) => api.del(`/departments/${id}/members/${userId}`),
  categories: () => api.get("/departments/categories"),
  stats: () => api.get("/departments/stats"),
  create: (payload) => api.post("/departments", payload),
  remove: (id) => api.del(`/departments/${id}`),
  removeCompany: (id) => api.del(`/departments/companies/${id}`),
  setResponsible: (id, responsibleId) => api.patch(`/departments/${id}`, { responsibleId }),
};

export const chatApi = {
  rooms: () => api.get("/chat/rooms"),
  createRoom: (payload) => api.post("/chat/rooms", payload),
  patchRoom: (id, payload) => api.patch(`/chat/rooms/${id}`, payload),
  deleteRoom: (id) => api.del(`/chat/rooms/${id}`),
  messages: (id) => api.get(`/chat/rooms/${id}/messages`),
  unread: () => api.get("/chat/unread"),
  markRoomRead: (id) => api.post(`/chat/rooms/${id}/read`),
  upload: (formData) => api.postForm("/chat/upload", formData),
};

export const configApi = {
  get: () => api.get("/config"),
  saveSla: (entries) => api.patch("/config/sla", { entries }),
  saveCalendrier: (payload) => api.patch("/config/calendrier", payload),
  addFerie: (date, libelle) => api.post("/config/ferie", { date, libelle }),
  removeFerie: (id) => api.del(`/config/ferie/${id}`),
  setDispatcher: (userId, peutDispatcher) => api.patch(`/config/dispatcher/${userId}`, { peutDispatcher }),
};

export const settingsApi = {
  get: () => api.get("/settings"),
  update: (payload) => api.patch("/settings", payload),
  getBranding: () => api.get("/settings/branding"),
  updateBranding: (payload) => api.patch("/settings/branding", payload),
};

export const notificationsApi = {
  list: () => api.get("/notifications"),
  readAll: () => api.post("/notifications/read-all"),
  read: (id) => api.post(`/notifications/${id}/read`),
  getPreferences: () => api.get("/notifications/preferences"),
  updatePreferences: (payload) => api.patch("/notifications/preferences", payload),
};

export const pushApi = {
  publicKey: () => api.get("/push/public-key"),
  subscribe: (payload) => api.post("/push/subscribe", payload),
  unsubscribe: (payload) => api.post("/push/unsubscribe", payload),
};

export const usersApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return api.get(`/users${qs ? `?${qs}` : ""}`);
  },
  stats: () => api.get("/users/stats"),
  presence: () => api.get("/users/presence"),
  create: (payload) => api.post("/users", payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  remove: (id) => api.del(`/users/${id}`),
};
