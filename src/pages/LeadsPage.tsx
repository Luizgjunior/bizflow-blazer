import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import ScoreBadge from '@/components/ScoreBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE = 10;

export default function LeadsPage() {
  const { tenantId } = useAuth();
  const [search, setSearch] = useState('');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [page, setPage] = useState(0);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('score', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = allLeads.filter((l: any) => {
    const matchSearch = l.razao_social.toLowerCase().includes(search.toLowerCase()) || l.cnpj.includes(search);
    const matchUf = ufFilter === 'all' || l.uf === ufFilter;
    return matchSearch && matchUf;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AppLayout>
      <PageHeader
        title="Leads"
        description={`${filtered.length} leads encontrados`}
        actions={<Button size="sm" variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> Exportar</Button>}
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
            {['SP', 'RJ', 'PR', 'SC', 'RS', 'MG', 'BA', 'PE'].map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p></div>
      ) : (
        <>
          <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 pl-4">Empresa</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">CNPJ</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">UF</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">CNAE</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Situação</th>
                  <th className="text-center text-xs font-medium text-muted-foreground p-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    <td className="p-3 pl-4"><p className="text-sm font-medium text-foreground">{lead.razao_social}</p><p className="text-[11px] text-muted-foreground">{lead.municipio}</p></td>
                    <td className="p-3 text-xs text-muted-foreground font-mono">{lead.cnpj}</td>
                    <td className="p-3 text-sm text-muted-foreground">{lead.uf}</td>
                    <td className="p-3 text-xs text-muted-foreground">{lead.cnae_principal}</td>
                    <td className="p-3"><Badge variant={lead.situacao === 'Ativa' ? 'default' : 'destructive'} className="text-[10px]">{lead.situacao}</Badge></td>
                    <td className="p-3 text-center"><ScoreBadge score={lead.score ?? 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-2">
            {paginated.map((lead: any) => (
              <div key={lead.id} className="rounded-xl border border-border bg-card p-3.5 active:bg-muted/30 transition-colors" onClick={() => setSelectedLead(lead)}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{lead.razao_social}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{lead.cnpj}</p>
                  </div>
                  <ScoreBadge score={lead.score ?? 0} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf}</span>
                  <Badge variant={lead.situacao === 'Ativa' ? 'default' : 'destructive'} className="text-[10px]">{lead.situacao}</Badge>
                </div>
              </div>
            ))}
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

      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader><SheetTitle className="text-left">{selectedLead.razao_social}</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-3">
                  <ScoreBadge score={selectedLead.score ?? 0} />
                  <Badge variant={selectedLead.situacao === 'Ativa' ? 'default' : 'destructive'}>{selectedLead.situacao}</Badge>
                </div>
                <div className="space-y-3">
                  {[['CNPJ', selectedLead.cnpj], ['UF', selectedLead.uf], ['Município', selectedLead.municipio], ['CNAE Principal', selectedLead.cnae_principal], ['Data Abertura', selectedLead.data_abertura ? new Date(selectedLead.data_abertura).toLocaleDateString('pt-BR') : '—']].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-2 border-b border-border">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
                    </div>
                  ))}
                </div>
                {selectedLead.tags?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Tags</p>
                    <div className="flex gap-1.5">{selectedLead.tags.map((tag: string) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
                  </div>
                )}
                {selectedLead.notas && (
                  <div><p className="text-xs text-muted-foreground mb-1">Notas</p><p className="text-sm text-foreground">{selectedLead.notas}</p></div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
