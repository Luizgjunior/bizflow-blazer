import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, Download, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RunsPage() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ['runs', tenantId, statusFilter],
    queryFn: async () => {
      let q = supabase.from('runs').select('*, icps(nome)').order('requested_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Poll every 10s for status updates
  });

  const checkRun = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('check-run', {
        body: { run_id: runId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-count'] });
      if (data.status === 'done') {
        toast.success(`${data.total_leads} leads importados!`);
      } else {
        toast.info(data.message || 'Ainda processando...');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportRun = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('export-leads', {
        body: { run_id: runId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      if (data.download_url) {
        window.open(data.download_url, '_blank');
        toast.success(`Export de ${data.rows_count} leads gerado!`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <PageHeader
        title="Runs"
        description="Histórico de execuções de ICPs"
        actions={<Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /> Atualizar</Button>}
      />
      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="queued">Na fila</SelectItem>
            <SelectItem value="running">Executando</SelectItem>
            <SelectItem value="done">Concluído</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhuma execução encontrada.</p></div>
      ) : (
        <>
          <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 pl-4">ICP</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Leads</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Solicitado</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Finalizado</th>
                  <th className="text-right text-xs font-medium text-muted-foreground p-3 pr-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run: any) => (
                  <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 pl-4 text-sm font-medium text-foreground">{run.icps?.nome || '—'}</td>
                    <td className="p-3"><StatusBadge status={run.status} /></td>
                    <td className="p-3 text-sm text-muted-foreground">{run.total_leads || '—'}</td>
                    <td className="p-3 text-sm text-muted-foreground">{new Date(run.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 text-sm text-muted-foreground">{run.finished_at ? new Date(run.finished_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="p-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(run.status === 'running' || run.status === 'queued') && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                            onClick={() => checkRun.mutate(run.id)} disabled={checkRun.isPending}>
                            {checkRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Verificar
                          </Button>
                        )}
                        {run.status === 'done' && (
                          <>
                            <Link to="/leads"><Button size="sm" variant="ghost" className="h-7 px-2"><Eye className="w-3.5 h-3.5" /></Button></Link>
                            <Button size="sm" variant="ghost" className="h-7 px-2"
                              onClick={() => exportRun.mutate(run.id)} disabled={exportRun.isPending}>
                              {exportRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {runs.map((run: any, i: number) => (
              <motion.div key={run.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{run.icps?.nome || '—'}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(run.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                {run.total_leads > 0 && <p className="text-xs text-muted-foreground mb-3">{run.total_leads} leads gerados</p>}
                <div className="flex gap-2">
                  {(run.status === 'running' || run.status === 'queued') && (
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
                      onClick={() => checkRun.mutate(run.id)} disabled={checkRun.isPending}>
                      {checkRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Verificar Status
                    </Button>
                  )}
                  {run.status === 'done' && (
                    <>
                      <Link to="/leads" className="flex-1"><Button size="sm" variant="outline" className="w-full gap-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> Ver Leads</Button></Link>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                        onClick={() => exportRun.mutate(run.id)} disabled={exportRun.isPending}>
                        {exportRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </Button>
                    </>
                  )}
                </div>
                {run.status === 'error' && run.error_json && <p className="text-xs text-destructive mt-2">{(run.error_json as any).message}</p>}
              </motion.div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
