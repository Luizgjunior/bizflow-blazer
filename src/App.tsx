import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";

// Eagerly loaded (core pages for instant navigation)
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import LeadsPage from "./pages/LeadsPage";

// Lazy loaded (less frequent pages)
const ICPsPage = lazy(() => import("./pages/ICPsPage"));
const RunsPage = lazy(() => import("./pages/RunsPage"));
const ExportsPage = lazy(() => import("./pages/ExportsPage"));
const AutomacaoPage = lazy(() => import("./pages/AutomacaoPage"));
const BackofficePage = lazy(() => import("./pages/BackofficePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const DisparosPage = lazy(() => import("./pages/DisparosPage"));
const WhatsAppChatPage = lazy(() => import("./pages/WhatsAppChatPage"));
const CrmKanbanPage = lazy(() => import("./pages/CrmKanbanPage"));
const CrmDashboardPage = lazy(() => import("./pages/CrmDashboardPage"));
const AjudaPage = lazy(() => import("./pages/AjudaPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/planos" element={<PlanosPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/" element={<Index />} />
        <Route path="/icps" element={<ProtectedRoute><ICPsPage /></ProtectedRoute>} />
        <Route path="/runs" element={<ProtectedRoute><RunsPage /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
        <Route path="/exports" element={<ProtectedRoute><ExportsPage /></ProtectedRoute>} />
        <Route path="/automacao" element={<ProtectedRoute><AutomacaoPage /></ProtectedRoute>} />
        <Route path="/disparos" element={<ProtectedRoute><DisparosPage /></ProtectedRoute>} />
        <Route path="/whatsapp-chat" element={<ProtectedRoute><WhatsAppChatPage /></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute><CrmKanbanPage /></ProtectedRoute>} />
        <Route path="/crm-dashboard" element={<ProtectedRoute><CrmDashboardPage /></ProtectedRoute>} />
        <Route path="/backoffice" element={<ProtectedRoute><BackofficePage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
