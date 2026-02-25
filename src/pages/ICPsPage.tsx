import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, MoreVertical, Edit, Trash2, Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function ICPsPage() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [cnaes, setCnaes] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [porte, setPorte] = useState('');
  const [tempoAbertura, setTempoAbertura] = useState('');
  const [exclusoes, setExclusoes] = useState('');

  const { data: icps = [], isLoading } = useQuery({
    queryKey: ['icps', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('icps').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createIcp = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sem tenant');
      const payload: Record<string, any> = {};
      if (cnaes) payload.cnaes = cnaes.split(',').map(s => s.trim());
      if (uf) payload.uf = uf;
      if (municipio) payload.municipio = municipio;
      if (porte) payload.porte = porte;
      if (tempoAbertura) payload.tempo_abertura_min = parseInt(tempoAbertura);
      if (exclusoes) payload.exclusoes = exclusoes;

      const { error } = await supabase.from('icps').insert({
        tenant_id: tenantId,
        nome,
        payload_json: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icps'] });
      toast.success('ICP criado!');
      setDialogOpen(false);
      setNome(''); setCnaes(''); setUf(''); setMunicipio(''); setPorte(''); setTempoAbertura(''); setExclusoes('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteIcp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('icps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icps'] });
      toast.success('ICP excluído');
    },
  });

  const filtered = icps.filter((icp: any) =>
    icp.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader
        title="ICPs"
        description="Perfis ideais de cliente para geração de leads"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!tenantId}>
                <Plus className="w-4 h-4" /> Novo ICP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Criar ICP</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Nome do ICP</Label>
                  <Input placeholder="Ex: SaaS B2B - São Paulo" className="mt-1.5" value={nome} onChange={e => setNome(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CNAEs</Label>
                    <Input placeholder="6201-5/01, 6202-3/00" className="mt-1.5" value={cnaes} onChange={e => setCnaes(e.target.value)} />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE'].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Município</Label>
                    <Input placeholder="São Paulo" className="mt-1.5" value={municipio} onChange={e => setMunicipio(e.target.value)} />
                  </div>
                  <div>
                    <Label>Porte</Label>
                    <Select value={porte} onValueChange={setPorte}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEI">MEI</SelectItem>
                        <SelectItem value="ME">ME</SelectItem>
                        <SelectItem value="EPP">EPP</SelectItem>
                        <SelectItem value="Demais">Demais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Tempo mínimo de abertura (anos)</Label>
                  <Input type="number" placeholder="2" className="mt-1.5" value={tempoAbertura} onChange={e => setTempoAbertura(e.target.value)} />
                </div>
                <div>
                  <Label>Exclusões</Label>
                  <Textarea placeholder="CNPJs ou CNAEs a excluir..." className="mt-1.5" rows={2} value={exclusoes} onChange={e => setExclusoes(e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => createIcp.mutate()} disabled={!nome || createIcp.isPending}>
                  {createIcp.isPending ? 'Salvando...' : 'Salvar ICP'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar ICP..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Nenhum ICP encontrado. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {filtered.map((icp: any, i: number) => {
            const payload = icp.payload_json as Record<string, any> || {};
            return (
              <motion.div key={icp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{icp.nome}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">v{icp.versao} • {new Date(icp.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 text-muted-foreground hover:text-foreground"><MoreVertical className="w-4 h-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => deleteIcp.mutate(icp.id)} className="text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {payload.cnaes && <Badge variant="secondary" className="text-[10px]">CNAE: {payload.cnaes[0]}</Badge>}
                  {payload.uf && <Badge variant="secondary" className="text-[10px]">{payload.uf}</Badge>}
                  {payload.porte && <Badge variant="secondary" className="text-[10px]">{payload.porte}</Badge>}
                </div>
                <Button size="sm" variant="outline" className="w-full gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Executar
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
