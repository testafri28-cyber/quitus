// Bannière affichée quand la session frontoffice est une CONSULTATION éditeur
// (jeton à scope "impersonation"). Détecte le claim sans appel serveur, et permet de quitter.
import { getToken, setToken, BASE_URL } from "../api/client.js";

function decodeJwt(token) {
  try {
    const part = token.split(".")[1];
    const json = decodeURIComponent(escape(atob(part.replace(/-/g, "+").replace(/_/g, "/"))));
    return JSON.parse(json);
  } catch { return null; }
}

export function ImpersonationBanner() {
  const token = getToken();
  const claims = token ? decodeJwt(token) : null;
  if (!claims || claims.scope !== "impersonation") return null;

  const stop = async () => {
    try {
      await fetch(`${BASE_URL}/api/superadmin/impersonate/stop`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* on quitte quand même */ }
    setToken(null);
    window.location.href = "/login";
  };

  return (
    <div className="imp-banner">
      <span className="imp-text">
        Vous consultez le frontoffice <strong>en tant que {claims.tenantName || "client"}</strong> — session éditeur (tracée).
      </span>
      <button className="imp-quit" onClick={stop}>Quitter</button>
    </div>
  );
}
