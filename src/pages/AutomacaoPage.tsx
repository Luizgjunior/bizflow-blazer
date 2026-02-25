import { useState } from 'react';
import { Plus, Zap, Clock, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { mockAutomations } from '@/data/mock';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockICPs } from '@/data/mock';

export default function AutomacaoPage() {
  const [automations, setAutomations] = useState(mockAutomations);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleActive = (id: string) => {
    setAutomations(prev =>
      prev.map(a => a.id === id ? { ...a, ativa: !a.ativa } : a)
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Automação"
        description="Agende execuções recorrentes de ICPs"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Nova Automação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Automação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>ICP</Label>
                  <Select>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o ICP" /></SelectTrigger>
                    <SelectContent>
                      {mockICPs.map(icp => (
                        <SelectItem key={icp.id} value={icp.id}>{icp.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequência</Label>
                  <Select>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setDialogOpen(false)}>
                  Criar Automação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-3">
        {automations.map((auto, i) => (
          <motion.div
            key={auto.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${auto.ativa ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Zap className={`w-5 h-5 ${auto.ativa ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{auto.icp_nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {auto.frequencia === 'diaria' ? 'Diária' : 'Semanal'}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Próxima: {new Date(auto.proxima_execucao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={auto.ativa ? 'ativa' : 'inativa'} />
                <Switch checked={auto.ativa} onCheckedChange={() => toggleActive(auto.id)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
