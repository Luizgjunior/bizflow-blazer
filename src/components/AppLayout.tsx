import { ReactNode, useCallback, useMemo } from 'react';
import PageTransition from '@/components/PageTransition';
import Leadzinho from '@/components/Leadzinho';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Target,
  Play,
  Users,
  Download,
  Zap,
  Send,
  Megaphone,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  MessageSquare,
  Kanban,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useState } from 'react';

// Prefetch map for lazy-loaded routes
const prefetchMap: Record<string, () => void> = {
  '/icps': () => import('@/pages/ICPsPage'),
  '/runs': () => import('@/pages/RunsPage'),
  '/exports': () => import('@/pages/ExportsPage'),
  '/automacao': () => import('@/pages/AutomacaoPage'),
  '/disparos': () => import('@/pages/DisparosPage'),
  '/campanhas': () => import('@/pages/CampanhasPage'),
  '/whatsapp-chat': () => import('@/pages/WhatsAppChatPage'),
  '/crm': () => import('@/pages/CrmKanbanPage'),
  '/crm-dashboard': () => import('@/pages/CrmDashboardPage'),
  '/backoffice': () => import('@/pages/BackofficePage'),
  '/ajuda': () => import('@/pages/AjudaPage'),
};

const navItems = [
  { path: '/crm-dashboard', label: 'CRM Dashboard', icon: BarChart3 },
  { path: '/whatsapp-chat', label: 'Chat WhatsApp', icon: MessageSquare },
  { path: '/crm', label: 'CRM Kanban', icon: Kanban },
  { path: '/', label: 'Dashboard de Prospecção', icon: LayoutDashboard },
  { path: '/icps', label: 'ICPs', icon: Target },
  { path: '/runs', label: 'Runs', icon: Play },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/exports', label: 'Exports', icon: Download },
  { path: '/automacao', label: 'Automação', icon: Zap },
  { path: '/disparos', label: 'Conexão', icon: Send },
];

const bottomNavItems = navItems.slice(0, 6);

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allNavItems = isAdmin
    ? [...navItems, { path: '/backoffice', label: 'Backoffice', icon: Shield }]
    : navItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed h-full z-30">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="LeadFlow" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">LeadFlow</h1>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {allNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => prefetchMap[item.path]?.()}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-0.5">
          <Link
            to="/ajuda"
            onMouseEnter={() => prefetchMap['/ajuda']?.()}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              location.pathname === '/ajuda'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Ajuda
          </Link>
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground truncate">{profile?.nome || 'Usuário'}</p>
            <p className="text-[10px] text-muted-foreground">{role === 'admin_global' ? 'Admin Global' : 'Empresa'}</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card/90 backdrop-blur-lg border-b border-border z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="LeadFlow" className="w-7 h-7 rounded-lg object-cover" />
          <span className="text-sm font-bold text-foreground">LeadFlow</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-muted-foreground">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Slide Menu */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="lg:hidden fixed right-0 top-14 bottom-0 w-64 bg-card border-l border-border z-50 p-4 animate-in slide-in-from-right duration-200"
          >
            <nav className="space-y-1">
              {allNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    onMouseEnter={() => prefetchMap[item.path]?.()}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-lg border-t border-border z-40 flex items-center justify-around px-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-all ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Leadzinho />
    </div>
  );
}
