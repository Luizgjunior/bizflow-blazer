import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ICPsPage = lazy(() => import("./pages/ICPsPage"));
const RunsPage = lazy(() => import("./pages/RunsPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const ExportsPage = lazy(() => import("./pages/ExportsPage"));
const AutomacaoPage = lazy(() => import("./pages/AutomacaoPage"));
const BackofficePage = lazy(() => import("./pages/BackofficePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min cache
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
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
          <Route path="/backoffice" element={<ProtectedRoute><BackofficePage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
