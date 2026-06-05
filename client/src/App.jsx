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
import Chat from "./pages/Chat.jsx";
import AdminGestion from "./pages/AdminGestion.jsx";

// Backoffice SaaS (éditeur Quitus) — espace séparé, AUTH PROPRE (table SuperAdmin,
// login dédié /superadmin/login). Aucun lien avec l'authentification du frontoffice.
import { SuperAuthProvider } from "./pages/superadmin/SuperAuth.jsx";
import SaLogin from "./pages/superadmin/Login.jsx";
import SuperadminLayout from "./pages/superadmin/Layout.jsx";
import SaCockpit from "./pages/superadmin/Cockpit.jsx";
import SaAccounts from "./pages/superadmin/Accounts.jsx";
import SaAccount360 from "./pages/superadmin/Account360.jsx";
import SaDashboard from "./pages/superadmin/Dashboard.jsx";
import SaInvoices from "./pages/superadmin/Invoices.jsx";
import SaRevenue from "./pages/superadmin/Revenue.jsx";
import SaStub from "./pages/superadmin/Stub.jsx";

// Redirige l'ancien détail /tenants/:id vers la nouvelle fiche 360°.
function TenantRedirect() {
  const { id } = useParams();
  return <Navigate to={`/superadmin/comptes/${id}`} replace />;
}

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
          <Route path="chat" element={<Chat />} />
          <Route path="gestion" element={<AdminGestion />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
        </Route>
      </Route>

      {/* Backoffice SaaS (éditeur) — espace + authentification DÉDIÉS (login séparé). */}
      <Route element={<SuperAuthProvider><Outlet /></SuperAuthProvider>}>
        <Route path="/superadmin/login" element={<SaLogin />} />
        <Route path="/superadmin" element={<SuperadminLayout />}>
          <Route index element={<SaCockpit />} />
          <Route path="comptes" element={<SaAccounts />} />
          <Route path="comptes/:id" element={<SaAccount360 />} />
          <Route path="invoices" element={<SaInvoices />} />
          <Route path="revenue" element={<SaRevenue />} />
          {/* Phase 2 — nav + routes stub */}
          <Route path="adoption" element={<SaStub title="Adoption" desc="Activation, usage et expansion des comptes." />} />
          <Route path="sante" element={<SaStub title="Santé & exploitation" desc="Disponibilité, incidents et exploitation technique." />} />
          <Route path="confiance" element={<SaStub title="Confiance & contrôle" desc="Sécurité, audit et conformité." />} />
          {/* Rétro-compatibilité (anciennes routes conservées) */}
          <Route path="apercu" element={<SaDashboard />} />
          <Route path="tenants" element={<Navigate to="/superadmin/comptes" replace />} />
          <Route path="tenants/:id" element={<TenantRedirect />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
