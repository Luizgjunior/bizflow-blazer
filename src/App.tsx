import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ICPsPage from "./pages/ICPsPage";
import RunsPage from "./pages/RunsPage";
import LeadsPage from "./pages/LeadsPage";
import ExportsPage from "./pages/ExportsPage";
import AutomacaoPage from "./pages/AutomacaoPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/icps" element={<ICPsPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/automacao" element={<AutomacaoPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
