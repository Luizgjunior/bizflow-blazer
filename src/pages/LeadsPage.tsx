import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, ChevronLeft, ChevronRight, Loader2, Save, Plus, X, Sparkles, FlameKindling, Flame, Snowflake } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import ScoreBadge from '@/components/ScoreBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

const PAGE_SIZE = 10;

const qualificationConfig = {
  hot: { label: 'Quente', icon: Flame, className: 'text-destructive bg-destructive/10' },
  warm: { label: 'Morno', icon: FlameKindling, className: 'text-warning bg-warning/10' },
  cold: { label: 'Frio', icon: Snowflake, className: 'text-blue-500 bg-blue-500/10' },
  unknown: { label: '—', icon: Snowflake, className: 'text-muted-foreground bg-muted' },
};

export default function LeadsPage() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [qualFilter, setQualFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [editNotas, setEditNotas] = useState('');
  const [newTag, setNewTag] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*')
        .not('tags', 'cs', '{"webhook"}')
        .order('score', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: icps = [] } = useQuery({
    queryKey: ['icps-for-enrich', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('icps').select('id, nome');
      return data ?? [];
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead atualizado!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enrichLeads = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const icpId = icps.length > 0 ? icps[0].id : undefined;
      const { data, error } = await supabase.functions.invoke('enrich-leads', {
        body: { lead_ids: leadIds, icp_id: icpId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedIds(new Set());
      toast.success(`${data.enriched} leads enriquecidos com IA!`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openLeadDetail = (lead: any) => {
    setSelectedLead(lead);
    setEditNotas(lead.notas || '');
  };

  const addTag = () => {
    if (!newTag.trim() || !selectedLead) return;
    const currentTags = selectedLead.tags || [];
    if (currentTags.includes(newTag.trim())) return;
    const updatedTags = [...currentTags, newTag.trim()];
    updateLead.mutate({ id: selectedLead.id, updates: { tags: updatedTags } });
    setSelectedLead({ ...selectedLead, tags: updatedTags });
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    if (!selectedLead) return;
    const updatedTags = (selectedLead.tags || []).filter((t: string) => t !== tag);
    updateLead.mutate({ id: selectedLead.id, updates: { tags: updatedTags } });
    setSelectedLead({ ...selectedLead, tags: updatedTags });
  };

  const saveNotas = () => {
    if (!selectedLead) return;
    updateLead.mutate({ id: selectedLead.id, updates: { notas: editNotas } });
    setSelectedLead({ ...selectedLead, notas: editNotas });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((l: any) => l.id)));
    }
  };

  const getLeadQualification = (lead: any): string => {
    const raw = lead.raw_json as Record<string, any> || {};
    return raw.ai_classification?.qualification || 'unknown';
  };

  const getScoreBreakdown = (lead: any): Record<string, number> | null => {
    const raw = lead.raw_json as Record<string, any> || {};
    return raw.score_breakdown || null;
  };

  const filtered = allLeads.filter((l: any) => {
    const matchSearch = l.razao_social.toLowerCase().includes(search.toLowerCase()) || l.cnpj.includes(search);
    const matchUf = ufFilter === 'all' || l.uf === ufFilter;
    const matchQual = qualFilter === 'all' || getLeadQualification(l) === qualFilter;
    return matchSearch && matchUf && matchQual;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const ufs = [...new Set(allLeads.map((l: any) => l.uf).filter(Boolean))].sort();

  return (
    <AppLayout>
      <PageHeader
        title="Leads"
        description={`${filtered.length} leads encontrados`}
        actions={
          selectedIds.size > 0 ? (
            <Button size="sm" className="gap-1.5" onClick={() => enrichLeads.mutate([...selectedIds])} disabled={enrichLeads.isPending}>
              {enrichLeads.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Enriquecer {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''}
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={ufFilter} onValueChange={(v) => { setUfFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {ufs.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={qualFilter} onValueChange={(v) => { setQualFilter(v); setPage(0); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Qualificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="hot">🔥 Quente</SelectItem>
            <SelectItem value="warm">🟡 Morno</SelectItem>
            <SelectItem value="cold">❄️ Frio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 pl-4 w-10">
                    <input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                      onChange={selectAll} className="rounded border-input" />
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Empresa</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">CNPJ</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">UF</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">CNAE</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Situação</th>
                  <th className="text-center text-xs font-medium text-muted-foreground p-3">Score</th>
                  <th className="text-center text-xs font-medium text-muted-foreground p-3">Qualif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((lead: any) => {
                  const qual = getLeadQualification(lead);
                  const config = qualificationConfig[qual as keyof typeof qualificationConfig] || qualificationConfig.unknown;
                  return (
                    <tr key={lead.id} className="hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="p-3 pl-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)} className="rounded border-input" />
                      </td>
                      <td className="p-3" onClick={() => openLeadDetail(lead)}><p className="text-sm font-medium text-foreground">{lead.razao_social}</p><p className="text-[11px] text-muted-foreground">{lead.municipio}</p></td>
                      <td className="p-3 text-xs text-muted-foreground font-mono" onClick={() => openLeadDetail(lead)}>{lead.cnpj}</td>
                      <td className="p-3 text-sm text-muted-foreground" onClick={() => openLeadDetail(lead)}>{lead.uf}</td>
                      <td className="p-3 text-xs text-muted-foreground" onClick={() => openLeadDetail(lead)}>{lead.cnae_principal}</td>
                      <td className="p-3" onClick={() => openLeadDetail(lead)}><Badge variant={lead.situacao === 'ATIVA' ? 'default' : 'destructive'} className="text-[10px]">{lead.situacao}</Badge></td>
                      <td className="p-3 text-center" onClick={() => openLeadDetail(lead)}><ScoreBadge score={lead.score ?? 0} /></td>
                      <td className="p-3 text-center" onClick={() => openLeadDetail(lead)}>
                        {qual !== 'unknown' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${config.className}`}>
                            <config.icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {paginated.map((lead: any) => {
              const qual = getLeadQualification(lead);
              const config = qualificationConfig[qual as keyof typeof qualificationConfig] || qualificationConfig.unknown;
              return (
                <div key={lead.id} className="rounded-xl border border-border bg-card p-3.5 active:bg-muted/30 transition-colors" onClick={() => openLeadDetail(lead)}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{lead.razao_social}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{lead.cnpj}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={lead.score ?? 0} />
                      {qual !== 'unknown' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}>
                          <config.icon className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf}</span>
                    <Badge variant={lead.situacao === 'ATIVA' ? 'default' : 'destructive'} className="text-[10px]">{lead.situacao}</Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}</p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-xs text-muted-foreground px-2">{page + 1}/{totalPages}</span>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lead Detail Drawer */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader><SheetTitle className="text-left">{selectedLead.razao_social}</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <ScoreBadge score={selectedLead.score ?? 0} />
                  <Badge variant={selectedLead.situacao === 'ATIVA' ? 'default' : 'destructive'}>{selectedLead.situacao}</Badge>
                  {(() => {
                    const qual = getLeadQualification(selectedLead);
                    const config = qualificationConfig[qual as keyof typeof qualificationConfig] || qualificationConfig.unknown;
                    return qual !== 'unknown' ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
                        <config.icon className="w-3.5 h-3.5" />
                        {config.label}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* AI Classification */}
                {(() => {
                  const raw = selectedLead.raw_json as Record<string, any> || {};
                  const ai = raw.ai_classification;
                  if (!ai || ai.qualification === 'unknown') return null;
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Análise IA</p>
                      <p className="text-xs text-muted-foreground">{ai.reasoning}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Confiança:</span>
                        <Progress value={(ai.confidence || 0) * 100} className="flex-1 h-1.5" />
                        <span className="text-[11px] font-medium text-foreground">{Math.round((ai.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Score Breakdown */}
                {(() => {
                  const breakdown = getScoreBreakdown(selectedLead);
                  if (!breakdown) return null;
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">Detalhamento do Score</p>
                      <div className="space-y-1.5">
                        {Object.entries(breakdown).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className={`text-[11px] font-medium ${value > 0 ? 'text-success' : 'text-muted-foreground'}`}>+{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  {[
                    ['CNPJ', selectedLead.cnpj],
                    ['UF', selectedLead.uf],
                    ['Município', selectedLead.municipio],
                    ['CNAE Principal', selectedLead.cnae_principal],
                    ['Data Abertura', selectedLead.data_abertura ? new Date(selectedLead.data_abertura).toLocaleDateString('pt-BR') : '—'],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-2 border-b border-border">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
                    </div>
                  ))}
                </div>

                {/* Enrich single lead */}
                {getLeadQualification(selectedLead) === 'unknown' && (
                  <Button size="sm" variant="outline" className="w-full gap-1.5"
                    onClick={() => enrichLeads.mutate([selectedLead.id])} disabled={enrichLeads.isPending}>
                    {enrichLeads.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Enriquecer com IA
                  </Button>
                )}

                {/* Tags */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(selectedLead.tags || []).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Nova tag..." value={newTag} onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTag()} className="text-sm" />
                    <Button size="sm" variant="outline" onClick={addTag} disabled={!newTag.trim()}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Notas</p>
                  <Textarea value={editNotas} onChange={e => setEditNotas(e.target.value)}
                    placeholder="Adicione notas sobre este lead..." rows={3} className="text-sm" />
                  <Button size="sm" className="mt-2 gap-1.5" onClick={saveNotas}
                    disabled={editNotas === (selectedLead.notas || '') || updateLead.isPending}>
                    <Save className="w-3.5 h-3.5" /> Salvar Notas
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
