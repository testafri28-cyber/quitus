// Session du backoffice éditeur — TOTALEMENT séparée du frontoffice (AuthContext).
// Jeton dédié (quitus_super_token), restauré via /api/superadmin/auth/me.
import { createContext, useContext, useEffect, useState } from "react";
import { superadminApi, getSuperToken, setSuperToken } from "../../api/superadmin.js";

const SuperAuthContext = createContext(null);

export function SuperAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!getSuperToken()) { setLoading(false); return; }
      try { const { admin } = await superadminApi.me(); if (active) setAdmin(admin); }
      catch { setSuperToken(null); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const login = async (email, password) => {
    const { token, admin } = await superadminApi.login(email, password);
    setSuperToken(token);
    setAdmin(admin);
    return admin;
  };
  const logout = () => { setSuperToken(null); setAdmin(null); };

  return (
    <SuperAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </SuperAuthContext.Provider>
  );
}

export function useSuperAuth() {
  return useContext(SuperAuthContext) || { admin: null, loading: false, login: async () => {}, logout: () => {} };
}
