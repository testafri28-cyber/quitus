// Appels API du backoffice SaaS — JETON DÉDIÉ (séparé du frontoffice).
// Le backoffice a sa propre session (clé localStorage distincte de `ticket_token`).
import { BASE_URL } from "./client.js";

const TOKEN_KEY = "quitus_super_token";
export const getSuperToken = () => localStorage.getItem(TOKEN_KEY);
export const setSuperToken = (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };

const qs = (params) => {
  const s = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v != null && v !== "")
  ).toString();
  return s ? `?${s}` : "";
};

async function saRequest(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getSuperToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE_URL}/api/superadmin${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `Erreur ${res.status}`); e.status = res.status; throw e; }
  return data;
}

export const superadminApi = {
  // Authentification (login séparé du frontoffice)
  login: (email, password) => saRequest("/auth/login", { method: "POST", body: { email, password } }),
  me: () => saRequest("/auth/me"),
  // Métier
  stats: () => saRequest("/stats"),
  revenue: () => saRequest("/revenue"),
  tenants: (params) => saRequest(`/tenants${qs(params)}`),
  createTenant: (payload) => saRequest("/tenants", { method: "POST", body: payload }),
  tenant: (id) => saRequest(`/tenants/${id}`),
  updateTenant: (id, payload) => saRequest(`/tenants/${id}`, { method: "PATCH", body: payload }),
  createInvoice: (id, payload) => saRequest(`/tenants/${id}/invoices`, { method: "POST", body: payload }),
  invoices: (params) => saRequest(`/invoices${qs(params)}`),
  payInvoice: (id, payload) => saRequest(`/invoices/${id}/pay`, { method: "PATCH", body: payload }),
};

// Métadonnées d'affichage (libellés FR, couleurs).
export const PLAN_META = {
  STARTER:   { label: "Starter",   color: "#6b7280" },
  ESSENTIEL: { label: "Essentiel", color: "#3b82f6" },
  PME:       { label: "PME",       color: "#6e62b6" },
  ENTERPRISE:{ label: "Enterprise",color: "#b45309" },
};
export const TENANT_STATUS_META = {
  TRIAL:     { label: "Essai",     color: "#c9933a" },
  ACTIVE:    { label: "Actif",     color: "#4f9d77" },
  SUSPENDED: { label: "Suspendu",  color: "#c66150" },
  CHURNED:   { label: "Parti",     color: "#97a1b0" },
};
export const INVOICE_STATUS_META = {
  PENDING:   { label: "En attente",color: "#c9933a" },
  PAID:      { label: "Payée",     color: "#4f9d77" },
  OVERDUE:   { label: "En retard", color: "#c66150" },
  CANCELLED: { label: "Annulée",   color: "#97a1b0" },
};
export const METHOD_META = {
  WAVE:          "Wave",
  ORANGE_MONEY:  "Orange Money",
  MTN_MOMO:      "MTN MoMo",
  BANK_TRANSFER: "Virement",
};
export const CYCLE_META = { MONTHLY: "Mensuel", QUARTERLY: "Trimestriel", ANNUAL: "Annuel" };

export const PLANS = ["STARTER", "ESSENTIEL", "PME", "ENTERPRISE"];
export const TENANT_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CHURNED"];
export const INVOICE_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
export const METHODS = ["WAVE", "ORANGE_MONEY", "MTN_MOMO", "BANK_TRANSFER"];

export const fcfa = (n) => (n ?? 0).toLocaleString("fr-FR") + " FCFA";
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
