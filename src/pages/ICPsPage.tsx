import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, MoreVertical, Edit, Trash2, Play, Loader2, Save } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const NATUREZA_JURIDICA = [
  { value: '2135', label: 'Empresário Individual' },
  { value: '2062', label: 'Sociedade Empresária Limitada' },
  { value: '2305', label: 'Sociedade Empresária Ltda (EIRELI)' },
  { value: '2291', label: 'Sociedade Unipessoal Limitada' },
  { value: '2240', label: 'Sociedade Anônima Fechada' },
  { value: '2259', label: 'Sociedade Anônima Aberta' },
  { value: '2143', label: 'Cooperativa' },
  { value: '3999', label: 'Associação Privada' },
];

export default function ICPsPage() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIcp, setEditingIcp] = useState<any>(null);

  // Form fields
  const [nome, setNome] = useState('');
  const [quantidadeLeads, setQuantidadeLeads] = useState('100');
  const [cnaes, setCnaes] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [porte, setPorte] = useState('');
  const [naturezaJuridica, setNaturezaJuridica] = useState('');
  const [capitalSocialMin, setCapitalSocialMin] = useState('');
  const [capitalSocialMax, setCapitalSocialMax] = useState('');
  const [situacaoCadastral, setSituacaoCadastral] = useState('ATIVA');
  const [tempoAbertura, setTempoAbertura] = useState('');
  const [dataAberturaInicio, setDataAberturaInicio] = useState('');
  const [dataAberturaFim, setDataAberturaFim] = useState('');
  const [comTelefone, setComTelefone] = useState(false);
  const [comEmail, setComEmail] = useState(false);
  const [exclusoes, setExclusoes] = useState('');

  const { data: icps = [], isLoading } = useQuery({
    queryKey: ['icps', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('icps').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setNome(''); setQuantidadeLeads('100'); setCnaes(''); setUf(''); setMunicipio('');
    setBairro(''); setCep(''); setPorte(''); setNaturezaJuridica('');
    setCapitalSocialMin(''); setCapitalSocialMax(''); setSituacaoCadastral('ATIVA');
    setTempoAbertura(''); setDataAberturaInicio(''); setDataAberturaFim('');
    setComTelefone(false); setComEmail(false); setExclusoes('');
    setEditingIcp(null);
  };

  const openEdit = (icp: any) => {
    const p = icp.payload_json as Record<string, any> || {};
    setEditingIcp(icp);
    setNome(icp.nome);
    setQuantidadeLeads(p.quantidade_leads?.toString() || '100');
    setCnaes(p.cnaes?.join(', ') || '');
    setUf(p.uf || '');
    setMunicipio(p.municipio || '');
    setBairro(p.bairro || '');
    setCep(p.cep || '');
    setPorte(p.porte || '');
    setNaturezaJuridica(p.natureza_juridica || '');
    setCapitalSocialMin(p.capital_social_min?.toString() || '');
    setCapitalSocialMax(p.capital_social_max?.toString() || '');
    setSituacaoCadastral(p.situacao_cadastral || 'ATIVA');
    setTempoAbertura(p.tempo_abertura_min?.toString() || '');
    setDataAberturaInicio(p.data_abertura_inicio || '');
    setDataAberturaFim(p.data_abertura_fim || '');
    setComTelefone(p.com_telefone || false);
    setComEmail(p.com_email || false);
    setExclusoes(p.exclusoes || '');
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {};
    payload.quantidade_leads = parseInt(quantidadeLeads) || 100;
    if (cnaes) payload.cnaes = cnaes.split(',').map(s => s.trim()).filter(Boolean);
    if (uf) payload.uf = uf;
    if (municipio) payload.municipio = municipio;
    if (bairro) payload.bairro = bairro;
    if (cep) payload.cep = cep;
    if (porte) payload.porte = porte;
    if (naturezaJuridica) payload.natureza_juridica = naturezaJuridica;
    if (capitalSocialMin) payload.capital_social_min = parseFloat(capitalSocialMin);
    if (capitalSocialMax) payload.capital_social_max = parseFloat(capitalSocialMax);
    if (situacaoCadastral) payload.situacao_cadastral = situacaoCadastral;
    if (tempoAbertura) payload.tempo_abertura_min = parseInt(tempoAbertura);
    if (dataAberturaInicio) payload.data_abertura_inicio = dataAberturaInicio;
    if (dataAberturaFim) payload.data_abertura_fim = dataAberturaFim;
    if (comTelefone) payload.com_telefone = true;
    if (comEmail) payload.com_email = true;
    if (exclusoes) payload.exclusoes = exclusoes;
    return payload;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sem tenant');
      const payload = buildPayload();

      if (editingIcp) {
        const { error } = await supabase.from('icps').update({
          nome,
          payload_json: payload,
          versao: (editingIcp.versao || 1) + 1,
        }).eq('id', editingIcp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('icps').insert({
          tenant_id: tenantId,
          nome,
          payload_json: payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icps'] });
      toast.success(editingIcp ? 'ICP atualizado! Nova versão criada.' : 'ICP criado!');
      setDialogOpen(false);
      resetForm();
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

  const executeIcp = useMutation({
    mutationFn: async (icpId: string) => {
      const { data, error } = await supabase.functions.invoke('run-icp', {
        body: { icp_id: icpId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-runs'] });
      toast.success(`Run criada! ${data.message || ''}`);
    },
    onError: (e: any) => toast.error(`Erro ao executar: ${e.message}`),
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
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!tenantId}>
                <Plus className="w-4 h-4" /> Novo ICP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>{editingIcp ? `Editar ICP (v${editingIcp.versao})` : 'Criar ICP'}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] px-6 pb-6">
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <Label>Nome do ICP *</Label>
                      <Input placeholder="Ex: SaaS B2B - São Paulo" className="mt-1.5" value={nome} onChange={e => setNome(e.target.value)} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label>Quantidade de leads</Label>
                      <Input type="number" placeholder="100" className="mt-1.5" value={quantidadeLeads} onChange={e => setQuantidadeLeads(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground mt-1">Máx. de leads retornados pela API</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Filtros de Atividade</p>
                    <div className="space-y-3">
                      <div>
                        <Label>CNAEs (separados por vírgula)</Label>
                        <Input placeholder="6201-5/01, 6202-3/00" className="mt-1.5" value={cnaes} onChange={e => setCnaes(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Situação Cadastral</Label>
                          <Select value={situacaoCadastral} onValueChange={setSituacaoCadastral}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ATIVA">Ativa</SelectItem>
                              <SelectItem value="BAIXADA">Baixada</SelectItem>
                              <SelectItem value="INAPTA">Inapta</SelectItem>
                              <SelectItem value="SUSPENSA">Suspensa</SelectItem>
                              <SelectItem value="NULA">Nula</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Natureza Jurídica</Label>
                          <Select value={naturezaJuridica} onValueChange={setNaturezaJuridica}>
                            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Todas</SelectItem>
                              {NATUREZA_JURIDICA.map(nj => (
                                <SelectItem key={nj.value} value={nj.value}>{nj.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Filtros de Localização</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>UF</Label>
                        <Select value={uf} onValueChange={setUf}>
                          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Todas" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Todas</SelectItem>
                            {UF_LIST.map(u => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Município</Label>
                        <Input placeholder="São Paulo" className="mt-1.5" value={municipio} onChange={e => setMunicipio(e.target.value)} />
                      </div>
                      <div>
                        <Label>Bairro</Label>
                        <Input placeholder="Centro" className="mt-1.5" value={bairro} onChange={e => setBairro(e.target.value)} />
                      </div>
                      <div>
                        <Label>CEP</Label>
                        <Input placeholder="01001000" className="mt-1.5" value={cep} onChange={e => setCep(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Filtros de Porte e Capital</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Porte</Label>
                        <Select value={porte} onValueChange={setPorte}>
                          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Todos</SelectItem>
                            <SelectItem value="MEI">MEI</SelectItem>
                            <SelectItem value="ME">ME</SelectItem>
                            <SelectItem value="EPP">EPP</SelectItem>
                            <SelectItem value="Demais">Demais</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tempo mín. abertura (anos)</Label>
                        <Input type="number" placeholder="2" className="mt-1.5" value={tempoAbertura} onChange={e => setTempoAbertura(e.target.value)} />
                      </div>
                      <div>
                        <Label>Capital Social mín. (R$)</Label>
                        <Input type="number" placeholder="10000" className="mt-1.5" value={capitalSocialMin} onChange={e => setCapitalSocialMin(e.target.value)} />
                      </div>
                      <div>
                        <Label>Capital Social máx. (R$)</Label>
                        <Input type="number" placeholder="1000000" className="mt-1.5" value={capitalSocialMax} onChange={e => setCapitalSocialMax(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Filtros de Data de Abertura</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Abertura a partir de</Label>
                        <Input type="date" className="mt-1.5" value={dataAberturaInicio} onChange={e => setDataAberturaInicio(e.target.value)} />
                      </div>
                      <div>
                        <Label>Abertura até</Label>
                        <Input type="date" className="mt-1.5" value={dataAberturaFim} onChange={e => setDataAberturaFim(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Filtros de Contato</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={comTelefone} onChange={e => setComTelefone(e.target.checked)} className="rounded border-input" />
                        Somente com telefone
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={comEmail} onChange={e => setComEmail(e.target.checked)} className="rounded border-input" />
                        Somente com e-mail
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <Label>Exclusões (CNPJs separados por vírgula)</Label>
                    <Textarea placeholder="12345678000190, 98765432000101" className="mt-1.5" rows={2} value={exclusoes} onChange={e => setExclusoes(e.target.value)} />
                  </div>

                  <Button className="w-full gap-1.5" onClick={() => saveMutation.mutate()} disabled={!nome || saveMutation.isPending}>
                    {saveMutation.isPending ? 'Salvando...' : editingIcp ? (
                      <><Save className="w-4 h-4" /> Salvar (nova versão)</>
                    ) : 'Salvar ICP'}
                  </Button>
                </div>
              </ScrollArea>
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
                      <DropdownMenuItem onClick={() => openEdit(icp)}>
                        <Edit className="w-3.5 h-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteIcp.mutate(icp.id)} className="text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {payload.quantidade_leads && <Badge variant="outline" className="text-[10px]">{payload.quantidade_leads} leads</Badge>}
                  {payload.cnaes && <Badge variant="secondary" className="text-[10px]">CNAE: {payload.cnaes[0]}{payload.cnaes.length > 1 ? ` +${payload.cnaes.length - 1}` : ''}</Badge>}
                  {payload.uf && <Badge variant="secondary" className="text-[10px]">{payload.uf}</Badge>}
                  {payload.municipio && <Badge variant="secondary" className="text-[10px]">{payload.municipio}</Badge>}
                  {payload.bairro && <Badge variant="secondary" className="text-[10px]">{payload.bairro}</Badge>}
                  {payload.porte && <Badge variant="secondary" className="text-[10px]">{payload.porte}</Badge>}
                  {payload.natureza_juridica && <Badge variant="secondary" className="text-[10px]">NJ: {payload.natureza_juridica}</Badge>}
                  {payload.tempo_abertura_min && <Badge variant="secondary" className="text-[10px]">{payload.tempo_abertura_min}+ anos</Badge>}
                  {payload.situacao_cadastral && <Badge variant="secondary" className="text-[10px]">{payload.situacao_cadastral}</Badge>}
                  {payload.com_telefone && <Badge variant="secondary" className="text-[10px]">📞 Tel</Badge>}
                  {payload.com_email && <Badge variant="secondary" className="text-[10px]">📧 Email</Badge>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={executeIcp.isPending}
                  onClick={() => executeIcp.mutate(icp.id)}
                >
                  {executeIcp.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Executando...</>
                  ) : (
                    <><Play className="w-3.5 h-3.5" /> Executar</>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}