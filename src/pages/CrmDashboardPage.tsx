import { useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { usePipelineStages, useCrmDeals, useRecentActivities, useCrmRealtime, CrmDeal } from '@/hooks/useCrmData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, CheckCircle2, XCircle, ArrowRight, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CrmDashboardPage() {
  useDocumentTitle('CRM Dashboard');
  useCrmRealtime();

  const { data: stages = [] } = usePipelineStages();
  const { data: deals = [], isLoading } = useCrmDeals();
  const { data: activities = [] } = useRecentActivities();

  const metrics = useMemo(() => {
    const activeDeals = deals.filter(d => !d.perdido && !d.ganho);
    const wonDeals = deals.filter(d => d.ganho);
    const lostDeals = deals.filter(d => d.perdido);
    const totalValue = activeDeals.reduce((sum, d) => sum + (d.valor || 0), 0);
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.valor || 0), 0);
    const conversionRate = deals.length > 0 ? (wonDeals.length / deals.length * 100) : 0;

    // Average time deals spend (days from created to now or closed)
    const avgDaysOpen = activeDeals.length > 0
      ? activeDeals.reduce((sum, d) => {
          const days = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / activeDeals.length
      : 0;

    return { activeDeals: activeDeals.length, wonDeals: wonDeals.length, lostDeals: lostDeals.length, totalValue, wonValue, conversionRate, avgDaysOpen };
  }, [deals]);

  const stageMetrics = useMemo(() => {
    return stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage_id === stage.id && !d.perdido && !d.ganho);
      const value = stageDeals.reduce((sum, d) => sum + (d.valor || 0), 0);
      return { ...stage, count: stageDeals.length, value };
    });
  }, [stages, deals]);

  // Revenue forecast per stage (weighted by position)
  const forecast = useMemo(() => {
    if (stages.length === 0) return 0;
    return stageMetrics.reduce((sum, s) => {
      const weight = (s.posicao + 1) / stages.length;
      return sum + s.value * weight;
    }, 0);
  }, [stageMetrics, stages]);

  const activityIcons: Record<string, string> = {
    criacao: '🆕',
    movimentacao: '➡️',
    nota: '📝',
    whatsapp: '📱',
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Dashboard CRM</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu pipeline de vendas em tempo real</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Deals Ativos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.activeDeals}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground font-medium">Valor no Pipeline</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {metrics.totalValue.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">Taxa de Conversão</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.conversionRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground font-medium">Tempo Médio (dias)</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.avgDaysOpen.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Funnel Visualization */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stageMetrics.map((stage, i) => {
                const maxCount = Math.max(...stageMetrics.map(s => s.count), 1);
                const widthPercent = Math.max((stage.count / maxCount) * 100, 8);
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-medium text-muted-foreground truncate">{stage.nome}</div>
                    <div className="flex-1">
                      <div
                        className="h-8 rounded-md flex items-center px-3 transition-all"
                        style={{ width: `${widthPercent}%`, backgroundColor: stage.cor + '20', borderLeft: `3px solid ${stage.cor}` }}
                      >
                        <span className="text-xs font-semibold text-foreground">{stage.count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-28 text-right">
                      R$ {stage.value.toLocaleString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Summary row */}
            <div className="flex gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Ganhos: <strong className="text-foreground">{metrics.wonDeals}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Perdidos: <strong className="text-foreground">{metrics.lostDeals}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">Ganho Total: <strong className="text-foreground">R$ {metrics.wonValue.toLocaleString('pt-BR')}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Forecast + Won/Lost */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Previsão de Receita</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">R$ {forecast.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground mt-1">Ponderada pela posição no funil</p>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {activities.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade ainda</p>
                )}
                {activities.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-start gap-2">
                    <span className="text-sm">{activityIcons[a.tipo] || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{a.descricao}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
