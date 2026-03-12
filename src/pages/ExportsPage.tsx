import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ExportsPage() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: exports = [], isLoading } = useQuery({
    queryKey: ['exports', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exports').select('*, runs(icps(nome))').eq('tenant_id', tenantId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDownload = (fileUrl: string | null) => {
    if (!fileUrl) {
      toast.error('Link de download indisponível');
      return;
    }
    window.open(fileUrl, '_blank');
  };

  const regenerateLink = useMutation({
    mutationFn: async (exp: any) => {
      // Re-export the run
      const { data, error } = await supabase.functions.invoke('export-leads', {
        body: { run_id: exp.run_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      if (data.download_url) {
        window.open(data.download_url, '_blank');
        toast.success('Novo link gerado!');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <PageHeader title="Exports" description="Histórico de arquivos exportados" />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : exports.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhum export ainda. Execute um ICP e exporte os leads.</p></div>
      ) : (
        <div className="space-y-3">
          {exports.map((exp: any, i: number) => {
            const icpName = (exp.runs as any)?.icps?.nome || 'ICP';
            return (
              <motion.div key={exp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-muted"><FileText className="w-5 h-5 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{icpName} — {exp.rows_count} registros</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(exp.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{exp.tipo}</Badge>
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => handleDownload(exp.file_url)}>
                    <Download className="w-3.5 h-3.5" /> Baixar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5"
                    onClick={() => regenerateLink.mutate(exp)}
                    disabled={regenerateLink.isPending}>
                    {regenerateLink.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
