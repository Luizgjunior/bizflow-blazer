import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Zap, Clock, Calendar, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AutomacaoPage() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIcp, setSelectedIcp] = useState('');
  const [freq, setFreq] = useState('');

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('automations').select('*, icps(nome)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: icps = [] } = useQuery({
    queryKey: ['icps-for-auto', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('icps').select('id, nome');
      return data ?? [];
    },
  });

  const createAuto = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sem tenant');
      const now = new Date();
      const proxima = freq === 'diaria'
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from('automations').insert({
        tenant_id: tenantId,
        icp_id: selectedIcp,
        frequencia: freq,
        proxima_execucao: proxima.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automação criada!');
      setDialogOpen(false);
      setSelectedIcp('');
      setFreq('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAuto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automação removida');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from('automations').update({ ativa }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  });

  return (
    <AppLayout>
      <PageHeader
        title="Automação"
        description="Agende execuções recorrentes de ICPs"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!tenantId}><Plus className="w-4 h-4" /> Nova Automação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Automação</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>ICP</Label>
                  <Select value={selectedIcp} onValueChange={setSelectedIcp}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o ICP" /></SelectTrigger>
                    <SelectContent>{icps.map((icp: any) => <SelectItem key={icp.id} value={icp.id}>{icp.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequência</Label>
                  <Select value={freq} onValueChange={setFreq}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => createAuto.mutate()} disabled={!selectedIcp || !freq || createAuto.isPending}>
                  {createAuto.isPending ? 'Criando...' : 'Criar Automação'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : automations.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhuma automação configurada.</p></div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto: any, i: number) => (
            <motion.div key={auto.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${auto.ativa ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Zap className={`w-5 h-5 ${auto.ativa ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{auto.icps?.nome || 'ICP'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{auto.frequencia === 'diaria' ? 'Diária' : 'Semanal'}</span>
                      {auto.proxima_execucao && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />Próxima: {new Date(auto.proxima_execucao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={auto.ativa ? 'ativa' : 'inativa'} />
                  <Switch checked={auto.ativa} onCheckedChange={(checked) => toggleActive.mutate({ id: auto.id, ativa: checked })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteAuto.mutate(auto.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
