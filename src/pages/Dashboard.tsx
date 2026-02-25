import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Target, Play, TrendingUp, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ScoreBadge from '@/components/ScoreBadge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { tenantId, isAdmin } = useAuth();

  const { data: leadsCount = 0 } = useQuery({
    queryKey: ['leads-count', tenantId],
    queryFn: async () => {
      const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      return count ?? 0;
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

  const { data: leads = [] } = useQuery({
    queryKey: ['recent-leads', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const activeRuns = runs.filter((r: any) => r.status === 'running' || r.status === 'queued').length;
  const errorRuns = runs.filter((r: any) => r.status === 'error');

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral da geração de leads" />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard title="Total Leads" value={leadsCount.toLocaleString()} icon={Users} variant="primary" />
          <StatCard title="Runs Ativas" value={activeRuns} icon={Play} variant="warning" />
          <StatCard title="ICPs Ativos" value={icpsCount} icon={Target} />
          <StatCard title="Execuções" value={runs.length} icon={TrendingUp} variant="accent" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
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

          {/* Recent Leads */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Leads Recentes</h2>
              <Link to="/leads" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {leads.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum lead ainda.</p>
              )}
              {leads.map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between p-3 px-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{lead.razao_social}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf} • {lead.cnae_principal}</p>
                  </div>
                  <ScoreBadge score={lead.score ?? 0} />
                </div>
              ))}
            </div>
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
