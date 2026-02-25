import { useState } from 'react';
import { Search, Download, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import ScoreBadge from '@/components/ScoreBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { mockLeads } from '@/data/mock';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Lead } from '@/types';

const PAGE_SIZE = 10;

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [ufFilter, setUfFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [page, setPage] = useState(0);

  const filtered = mockLeads
    .filter(l => {
      const matchSearch = l.razao_social.toLowerCase().includes(search.toLowerCase()) ||
        l.cnpj.includes(search);
      const matchUf = ufFilter === 'all' || l.uf === ufFilter;
      return matchSearch && matchUf;
    })
    .sort((a, b) => b.score - a.score);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AppLayout>
      <PageHeader
        title="Leads"
        description={`${filtered.length} leads encontrados`}
        actions={
          <Button size="sm" variant="outline" className="gap-1.5">
            <Download className="w-4 h-4" /> Exportar
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={ufFilter} onValueChange={(v) => { setUfFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {['SP', 'RJ', 'PR', 'SC', 'RS', 'MG', 'BA', 'PE'].map(uf => (
              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
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
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <td className="p-3 pl-4">
                  <p className="text-sm font-medium text-foreground">{lead.razao_social}</p>
                  <p className="text-[11px] text-muted-foreground">{lead.municipio}</p>
                </td>
                <td className="p-3 text-sm text-muted-foreground font-mono text-xs">{lead.cnpj}</td>
                <td className="p-3 text-sm text-muted-foreground">{lead.uf}</td>
                <td className="p-3 text-sm text-muted-foreground text-xs">{lead.cnae_principal}</td>
                <td className="p-3">
                  <Badge variant={lead.situacao === 'Ativa' ? 'default' : 'destructive'} className="text-[10px]">
                    {lead.situacao}
                  </Badge>
                </td>
                <td className="p-3 text-center"><ScoreBadge score={lead.score} /></td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {lead.tags?.map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        {paginated.map((lead) => (
          <div
            key={lead.id}
            className="rounded-xl border border-border bg-card p-3.5 active:bg-muted/30 transition-colors"
            onClick={() => setSelectedLead(lead)}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{lead.razao_social}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{lead.cnpj}</p>
              </div>
              <ScoreBadge score={lead.score} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-muted-foreground">{lead.municipio}/{lead.uf}</span>
              <span className="text-[11px] text-muted-foreground">•</span>
              <Badge variant={lead.situacao === 'Ativa' ? 'default' : 'destructive'} className="text-[10px]">
                {lead.situacao}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1}/{totalPages}</span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Lead Detail Drawer */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">{selectedLead.razao_social}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-3">
                  <ScoreBadge score={selectedLead.score} />
                  <Badge variant={selectedLead.situacao === 'Ativa' ? 'default' : 'destructive'}>
                    {selectedLead.situacao}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {[
                    ['CNPJ', selectedLead.cnpj],
                    ['UF', selectedLead.uf],
                    ['Município', selectedLead.municipio],
                    ['CNAE Principal', selectedLead.cnae_principal],
                    ['Data Abertura', new Date(selectedLead.data_abertura).toLocaleDateString('pt-BR')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-border">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </div>

                {selectedLead.tags && selectedLead.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Tags</p>
                    <div className="flex gap-1.5">
                      {selectedLead.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLead.notas && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm text-foreground">{selectedLead.notas}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
