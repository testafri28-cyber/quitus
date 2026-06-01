import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute, SpaceGuard } from "./components/Guards.jsx";
import { homePathFor } from "./lib/spaces.js";

import Login from "./pages/Login.jsx";
import GlobalHome from "./pages/GlobalHome.jsx";
import Submit from "./pages/Submit.jsx";
import LeaveRequest from "./pages/LeaveRequest.jsx";
import PrintDocument from "./pages/PrintDocument.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import TicketDetail from "./pages/TicketDetail.jsx";
import ServicesAnnuaire from "./pages/ServicesAnnuaire.jsx";
import AdminGestion from "./pages/AdminGestion.jsx";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(user)} replace />;
}

// Index d'un espace : global → accueil ; autres → file de tickets.
function SpaceIndex() {
  const { space } = useParams();
  if (space === "global") return <GlobalHome />;
  return <Navigate to="dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/document/:id" element={<PrintDocument />} />
        <Route
          path="/:space"
          element={
            <SpaceGuard>
              <Layout />
            </SpaceGuard>
          }
        >
          <Route index element={<SpaceIndex />} />
          <Route path="form" element={<Submit />} />
          <Route path="leave" element={<LeaveRequest />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="services" element={<ServicesAnnuaire />} />
          <Route path="gestion" element={<AdminGestion />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
