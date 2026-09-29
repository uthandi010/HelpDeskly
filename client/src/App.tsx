import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { OrganizationsPage } from "./pages/OrganizationsPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { PublicSupportPage } from "./pages/PublicSupportPage";
import { PublicTicketPage } from "./pages/PublicTicketPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/support/:slug" element={<PublicSupportPage />} />
          <Route path="/tickets/:ticketId/track" element={<PublicTicketPage />} />
          <Route
            path="/organizations"
            element={
              <ProtectedRoute>
                <OrganizationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations/:organizationId"
            element={
              <ProtectedRoute>
                <OrganizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/:ticketId"
            element={
              <ProtectedRoute>
                <TicketDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/organizations" replace />} />
          <Route path="*" element={<Navigate to="/organizations" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
