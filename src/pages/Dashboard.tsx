import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Target, Play, TrendingUp, AlertTriangle, ArrowRight, Loader2, Webhook, Search, Calendar, X, Building2, MapPin, FileText, Hash } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ScoreBadge from '@/components/ScoreBadge';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';

// Labels amigáveis para campos do raw_json
const fieldLabels: Record<string, string> = {
  cnpj: 'CNPJ',
  razao_social: 'Razão Social',
  nome_fantasia: 'Nome Fantasia',
  uf: 'UF',
  municipio: 'Município',
  bairro: 'Bairro',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  cep: 'CEP',
  cnae_fiscal: 'CNAE Fiscal',
  cnae_fiscal_descricao: 'Descrição CNAE',
  cnaes_secundarios: 'CNAEs Secundários',
  situacao_cadastral: 'Situação Cadastral',
  data_situacao_cadastral: 'Data Situação',
  data_inicio_atividade: 'Data Início Atividade',
  natureza_juridica: 'Natureza Jurídica',
  capital_social: 'Capital Social',
  porte: 'Porte',
  opcao_pelo_simples: 'Simples Nacional',
  opcao_pelo_mei: 'MEI',
  email: 'E-mail',
  telefone_1: 'Telefone 1',
  telefone_2: 'Telefone 2',
  ddd_telefone_1: 'DDD + Telefone 1',
  ddd_telefone_2: 'DDD + Telefone 2',
  qualificacao_do_responsavel: 'Qualificação Responsável',
  motivo_situacao_cadastral: 'Motivo Situação',
  data_evento: 'Data do Evento',
};

function formatFieldValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'capital_social' && typeof value === 'number') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function Dashboard() {
  const { tenantId, isAdmin } = useAuth();
  const [selectedLead, setSelectedLead] = useState<any>(null);

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

  const { data: runs = [] } = useQuery({
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

  const today = new Date().toISOString().slice(0, 10);
  const webhookToday = webhookLeads.filter((l: any) => l.created_at?.slice(0, 10) === today).length;

  // Extrair todos os campos do raw_json para exibição
  const getLeadDetails = (lead: any): Array<{ key: string; label: string; value: string }> => {
    const raw = (lead.raw_json as Record<string, any>) || {};
    const details: Array<{ key: string; label: string; value: string }> = [];

    // Campos fixos primeiro
    details.push({ key: 'cnpj', label: 'CNPJ', value: lead.cnpj || '—' });
    details.push({ key: 'razao_social', label: 'Razão Social', value: lead.razao_social || '—' });
    details.push({ key: 'situacao', label: 'Situação', value: lead.situacao || '—' });
    details.push({ key: 'uf', label: 'UF', value: lead.uf || '—' });
    details.push({ key: 'municipio', label: 'Município', value: lead.municipio || '—' });
    details.push({ key: 'cnae_principal', label: 'CNAE Principal', value: lead.cnae_principal || '—' });
    if (lead.data_abertura) {
      details.push({ key: 'data_abertura', label: 'Data Abertura', value: new Date(lead.data_abertura).toLocaleDateString('pt-BR') });
    }

    // Campos adicionais do raw_json (excluindo os que já mostramos)
    const shownKeys = new Set(['cnpj', 'razao_social', 'uf', 'municipio', 'situacao', 'situacao_cadastral', 'data_inicio_atividade', 'cnae_fiscal']);
    for (const [key, value] of Object.entries(raw)) {
      if (shownKeys.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      details.push({ key, label, value: formatFieldValue(key, value) });
    }

    return details;
  };

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
                  <p className="text-[10px] text-muted-foreground">Recebidas via webhook</p>
                </div>
              </div>
              <Link to="/leads" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

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

            <div className="divide-y divide-border">
              {webhookLeads.length === 0 ? (
                <div className="p-6 text-center">
                  <Webhook className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lead via webhook ainda</p>
                </div>
              ) : (
                webhookLeads.slice(0, 5).map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 px-4 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedLead(lead)}>
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

            <div className="divide-y divide-border">
              {searchLeads.length === 0 ? (
                <div className="p-6 text-center">
                  <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lead pesquisado ainda</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Crie um ICP e execute uma pesquisa</p>
                </div>
              ) : (
                searchLeads.slice(0, 5).map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 px-4 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedLead(lead)}>
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

      {/* Lead Detail Drawer */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLead && (() => {
            const details = getLeadDetails(selectedLead);
            const isWebhook = (selectedLead.tags || []).includes('webhook');
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    {selectedLead.razao_social}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedLead.situacao === 'ATIVA' ? 'default' : 'destructive'}>{selectedLead.situacao}</Badge>
                  {isWebhook && <Badge variant="outline" className="text-[10px]">Webhook</Badge>}
                  <ScoreBadge score={selectedLead.score ?? 0} />
                </div>

                <div className="mt-6 space-y-1">
                  {details.map(({ key, label, value }) => (
                    <div key={key} className="flex justify-between py-2.5 border-b border-border">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-foreground text-right max-w-[60%] break-words">{value}</span>
                    </div>
                  ))}
                </div>

                {selectedLead.tags && selectedLead.tags.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLead.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground mt-6">
                  Recebido em {new Date(selectedLead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}