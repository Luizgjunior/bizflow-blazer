import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Target, Play, TrendingUp, AlertTriangle, ArrowRight, Loader2, Webhook, Search, Building2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ScoreBadge from '@/components/ScoreBadge';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { tenantId, isAdmin } = useAuth();

  const { data: allLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['dashboard-leads', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: icpsCount = 0 } = useQuery({
    queryKey: ['icps-count', tenantId],
    queryFn: async () => {
      const { count } = await supabase.from('icps').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['recent-runs', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('runs')
        .select('*, icps(nome)')
        .order('requested_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const webhookLeads = allLeads.filter((l: any) => (l.tags || []).includes('webhook'));
  const searchLeads = allLeads.filter((l: any) => !(l.tags || []).includes('webhook'));

  const activeRuns = runs.filter((r: any) => r.status === 'running' || r.status === 'queued').length;
  const errorRuns = runs.filter((r: any) => r.status === 'error');

  // Leads recebidos hoje via webhook
  const today = new Date().toISOString().slice(0, 10);
  const webhookToday = webhookLeads.filter((l: any) => l.created_at?.slice(0, 10) === today).length;

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral da geração de leads" />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard title="Total Leads" value={allLeads.length.toLocaleString()} icon={Users} variant="primary" />
          <StatCard title="Runs Ativas" value={activeRuns} icon={Play} variant="warning" />
          <StatCard title="ICPs Ativos" value={icpsCount} icon={Target} />
          <StatCard title="Execuções" value={runs.length} icon={TrendingUp} variant="accent" />
        </div>

        {/* Two Origin Sections */}
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Webhook / Empresas Abertas */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Webhook className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Empresas Abertas</h2>
                  <p className="text-[10px] text-muted-foreground">Via webhook · Casa dos Dados</p>
                </div>
              </div>
              <Link to="/leads" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Webhook mini stats */}
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-card p-3 text-center">
                <p className="text-lg font-bold text-foreground">{webhookLeads.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
              </div>
              <div className="bg-card p-3 text-center">
                <p className="text-lg font-bold text-primary">{webhookToday}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoje</p>
              </div>
            </div>

            {/* Webhook leads list */}
            <div className="divide-y divide-border">
              {webhookLeads.length === 0 ? (
                <div className="p-6 text-center">
                  <Webhook className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lead via webhook ainda</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Configure o webhook no Backoffice</p>
                </div>
              ) : (
                webhookLeads.slice(0, 5).map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 px-4 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{lead.razao_social}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf}</span>
                        {lead.data_abertura && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(lead.data_abertura).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{lead.situacao}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pesquisados / Runs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent/10">
                  <Search className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Leads Pesquisados</h2>
                  <p className="text-[10px] text-muted-foreground">Via ICPs · Runs de pesquisa</p>
                </div>
              </div>
              <Link to="/leads" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Search mini stats */}
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-card p-3 text-center">
                <p className="text-lg font-bold text-foreground">{searchLeads.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
              </div>
              <div className="bg-card p-3 text-center">
                <p className="text-lg font-bold text-accent-foreground">{runs.filter((r: any) => r.status === 'done').length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Runs concluídas</p>
              </div>
            </div>

            {/* Search leads list */}
            <div className="divide-y divide-border">
              {searchLeads.length === 0 ? (
                <div className="p-6 text-center">
                  <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lead pesquisado ainda</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Crie um ICP e execute uma pesquisa</p>
                </div>
              ) : (
                searchLeads.slice(0, 5).map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 px-4 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{lead.razao_social}</p>
                      <p className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf} • {lead.cnae_principal}</p>
                    </div>
                    <ScoreBadge score={lead.score ?? 0} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Runs */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Execuções Recentes</h2>
            <Link to="/runs" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {runs.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma execução ainda.</p>
            )}
            {runs.map((run: any) => (
              <div key={run.id} className="flex items-center justify-between p-3 px-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{run.icps?.nome || 'ICP'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(run.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {run.total_leads > 0 && <span className="text-xs text-muted-foreground">{run.total_leads} leads</span>}
                  <StatusBadge status={run.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {errorRuns.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Execução com erro</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {errorRuns.length} execução(ões) com erro
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
