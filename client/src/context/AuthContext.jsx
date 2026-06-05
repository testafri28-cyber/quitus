import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/endpoints.js";
import { getToken, setToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restaure la session au chargement si un token est présent.
  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await authApi.me();
        if (active) setUser(user);
      } catch {
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    const { token, user } = await authApi.login(email, password);
    setToken(token);
    setUser(user);
    return user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  // Met à jour localement le profil en mémoire (ex. après modification du nom).
  function patchUser(fields) {
    setUser((u) => (u ? { ...u, ...fields } : u));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return ctx;
}
