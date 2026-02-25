import { Users, Target, Play, Download, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ScoreBadge from '@/components/ScoreBadge';
import { dashboardStats, mockRuns, mockLeads } from '@/data/mock';
import { Progress } from '@/components/ui/progress';

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export default function Dashboard() {
  const recentRuns = mockRuns.slice(0, 4);
  const recentLeads = mockLeads.slice(0, 5);

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description="Visão geral da geração de leads"
      />

      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard title="Total Leads" value={dashboardStats.totalLeads.toLocaleString()} icon={Users} variant="primary" trend={{ value: 12, label: 'vs semana' }} />
          <StatCard title="Leads Hoje" value={dashboardStats.leadsHoje} icon={TrendingUp} variant="accent" />
          <StatCard title="Runs Ativas" value={dashboardStats.runsAtivas} icon={Play} variant="warning" />
          <StatCard title="ICPs Ativos" value={dashboardStats.icpsAtivos} icon={Target} />
        </div>

        {/* Usage Bar */}
        <div className="rounded-xl border border-border bg-card p-4 lg:p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Uso de Consultas</p>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.limitesUsados.toLocaleString()} / {dashboardStats.limitesTotal.toLocaleString()}
            </p>
          </div>
          <Progress value={(dashboardStats.limitesUsados / dashboardStats.limitesTotal) * 100} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {((dashboardStats.limitesUsados / dashboardStats.limitesTotal) * 100).toFixed(0)}% utilizado do plano Pro
          </p>
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
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 px-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{run.icp_nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(run.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.total_leads > 0 && (
                      <span className="text-xs text-muted-foreground">{run.total_leads} leads</span>
                    )}
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
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 px-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{lead.razao_social}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf} • {lead.cnae_principal}</p>
                  </div>
                  <ScoreBadge score={lead.score} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {mockRuns.some(r => r.status === 'error') && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Execução com erro</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A run "{mockRuns.find(r => r.status === 'error')?.icp_nome}" falhou: Rate limit exceeded
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
