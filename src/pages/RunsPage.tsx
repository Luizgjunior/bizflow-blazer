import { useState } from 'react';
import { Eye, Download, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockRuns } from '@/data/mock';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function RunsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = statusFilter === 'all'
    ? mockRuns
    : mockRuns.filter(r => r.status === statusFilter);

  return (
    <AppLayout>
      <PageHeader
        title="Runs"
        description="Histórico de execuções de ICPs"
        actions={
          <Button size="sm" variant="outline" className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="queued">Na fila</SelectItem>
            <SelectItem value="running">Executando</SelectItem>
            <SelectItem value="done">Concluído</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards / Desktop table */}
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
            {filtered.map((run) => (
              <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-3 pl-4 text-sm font-medium text-foreground">{run.icp_nome}</td>
                <td className="p-3"><StatusBadge status={run.status} /></td>
                <td className="p-3 text-sm text-muted-foreground">{run.total_leads || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">
                  {new Date(run.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {run.finished_at ? new Date(run.finished_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="p-3 pr-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {run.status === 'done' && (
                      <>
                        <Link to="/leads">
                          <Button size="sm" variant="ghost" className="h-7 px-2"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <Button size="sm" variant="ghost" className="h-7 px-2"><Download className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map((run, i) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{run.icp_nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(run.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </div>
            {run.total_leads > 0 && (
              <p className="text-xs text-muted-foreground mb-3">{run.total_leads} leads gerados</p>
            )}
            {run.status === 'done' && (
              <div className="flex gap-2">
                <Link to="/leads" className="flex-1">
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                    <Eye className="w-3.5 h-3.5" /> Ver Leads
                  </Button>
                </Link>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {run.status === 'error' && run.error_json && (
              <p className="text-xs text-destructive">{(run.error_json as any).message}</p>
            )}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
