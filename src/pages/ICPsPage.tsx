import { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { mockICPs } from '@/data/mock';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ICPsPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = mockICPs.filter(icp =>
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
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Novo ICP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar ICP</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Nome do ICP</Label>
                  <Input placeholder="Ex: SaaS B2B - São Paulo" className="mt-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CNAEs</Label>
                    <Input placeholder="6201-5/01, 6202-3/00" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Select>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE'].map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Município</Label>
                    <Input placeholder="São Paulo" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Porte</Label>
                    <Select>
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
                  <Input type="number" placeholder="2" className="mt-1.5" />
                </div>
                <div>
                  <Label>Exclusões</Label>
                  <Textarea placeholder="CNPJs ou CNAEs a excluir..." className="mt-1.5" rows={2} />
                </div>
                <Button className="w-full" onClick={() => setDialogOpen(false)}>
                  Salvar ICP
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ICP..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {filtered.map((icp, i) => (
          <motion.div
            key={icp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{icp.nome}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">v{icp.versao} • Criado em {new Date(icp.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Edit className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {icp.payload_json.cnaes && (
                <Badge variant="secondary" className="text-[10px]">
                  CNAE: {Array.isArray(icp.payload_json.cnaes) ? icp.payload_json.cnaes[0] : icp.payload_json.cnaes}
                </Badge>
              )}
              {icp.payload_json.uf && (
                <Badge variant="secondary" className="text-[10px]">
                  {Array.isArray(icp.payload_json.uf) ? icp.payload_json.uf.join(', ') : icp.payload_json.uf}
                </Badge>
              )}
              {icp.payload_json.porte && (
                <Badge variant="secondary" className="text-[10px]">
                  {icp.payload_json.porte}
                </Badge>
              )}
            </div>

            <Button size="sm" variant="outline" className="w-full gap-1.5">
              <Play className="w-3.5 h-3.5" /> Executar
            </Button>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
}
