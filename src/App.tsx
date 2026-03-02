import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ICPsPage from "./pages/ICPsPage";
import RunsPage from "./pages/RunsPage";
import LeadsPage from "./pages/LeadsPage";
import ExportsPage from "./pages/ExportsPage";
import AutomacaoPage from "./pages/AutomacaoPage";

import BackofficePage from "./pages/BackofficePage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PlanosPage from "./pages/PlanosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/planos" element={<PlanosPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/icps" element={<ProtectedRoute><ICPsPage /></ProtectedRoute>} />
            <Route path="/runs" element={<ProtectedRoute><RunsPage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
            <Route path="/exports" element={<ProtectedRoute><ExportsPage /></ProtectedRoute>} />
            <Route path="/automacao" element={<ProtectedRoute><AutomacaoPage /></ProtectedRoute>} />
            
            <Route path="/backoffice" element={<ProtectedRoute><BackofficePage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
