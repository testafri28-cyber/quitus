import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { canUseSpace, homePathFor, SPACE_KEYS } from "../lib/spaces.js";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--text-3)" }}>Chargement…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Valide le segment :space et l'accès de l'utilisateur (/wca bloque les IDC, etc.).
export function SpaceGuard({ children }) {
  const { space } = useParams();
  const { user } = useAuth();
  if (!SPACE_KEYS.includes(space) || !canUseSpace(user, space)) {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return children;
}
