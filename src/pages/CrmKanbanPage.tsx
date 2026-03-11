import { useState, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import {
  usePipelineStages,
  useCrmDeals,
  useMoveDeal,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  useManageStages,
  useCrmRealtime,
  CrmDeal,
  PipelineStage,
} from '@/hooks/useCrmData';
import { Plus, MoreVertical, Settings2, Trash2, DollarSign, Phone, User, Building2, StickyNote, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CrmKanbanPage() {
  useDocumentTitle('CRM Kanban');
  useCrmRealtime();

  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages();
  const { data: deals = [], isLoading: dealsLoading } = useCrmDeals();
  const moveDeal = useMoveDeal();
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const { addStage, updateStage, deleteStage } = useManageStages();

  const [newDealDialog, setNewDealDialog] = useState<string | null>(null);
  const [editDealDialog, setEditDealDialog] = useState<CrmDeal | null>(null);
  const [pipelineDialog, setPipelineDialog] = useState(false);
  const [dealForm, setDealForm] = useState({ titulo: '', valor: '', telefone: '', contato_nome: '', cnpj: '', notas: '' });

  const dealsByStage = useMemo(() => {
    const map: Record<string, CrmDeal[]> = {};
    stages.forEach(s => { map[s.id] = []; });
    deals.filter(d => !d.perdido).forEach(d => {
      if (map[d.stage_id]) map[d.stage_id].push(d);
    });
    return map;
  }, [stages, deals]);

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const newStageId = result.destination.droppableId;
    const stage = stages.find(s => s.id === newStageId);
    moveDeal.mutate({ dealId, stageId: newStageId, stageName: stage?.nome });
  }, [stages, moveDeal]);

  const handleCreateDeal = async () => {
    if (!dealForm.titulo.trim() || !newDealDialog) return;
    try {
      await createDeal.mutateAsync({
        titulo: dealForm.titulo,
        stage_id: newDealDialog,
        valor: parseFloat(dealForm.valor) || 0,
        telefone: dealForm.telefone || null,
        contato_nome: dealForm.contato_nome || null,
        cnpj: dealForm.cnpj || null,
        notas: dealForm.notas || null,
      });
      toast.success('Deal criado!');
      setNewDealDialog(null);
      setDealForm({ titulo: '', valor: '', telefone: '', contato_nome: '', cnpj: '', notas: '' });
    } catch { toast.error('Erro ao criar deal'); }
  };

  const handleUpdateDeal = async () => {
    if (!editDealDialog) return;
    try {
      await updateDeal.mutateAsync({
        id: editDealDialog.id,
        titulo: dealForm.titulo,
        valor: parseFloat(dealForm.valor) || 0,
        telefone: dealForm.telefone || null,
        contato_nome: dealForm.contato_nome || null,
        cnpj: dealForm.cnpj || null,
        notas: dealForm.notas || null,
      });
      toast.success('Deal atualizado!');
      setEditDealDialog(null);
    } catch { toast.error('Erro ao atualizar'); }
  };

  const handleDeleteDeal = async (id: string) => {
    try {
      await deleteDeal.mutateAsync(id);
      toast.success('Deal removido');
      setEditDealDialog(null);
    } catch { toast.error('Erro ao remover'); }
  };

  const openEdit = (deal: CrmDeal) => {
    setDealForm({
      titulo: deal.titulo,
      valor: String(deal.valor || ''),
      telefone: deal.telefone || '',
      contato_nome: deal.contato_nome || '',
      cnpj: deal.cnpj || '',
      notas: deal.notas || '',
    });
    setEditDealDialog(deal);
  };

  if (stagesLoading || dealsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">CRM Kanban</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus deals no funil de vendas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPipelineDialog(true)}>
          <Settings2 className="w-4 h-4 mr-1" /> Configurar Funil
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {stages.map(stage => (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className="rounded-xl bg-muted/50 border border-border">
                {/* Column header */}
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.cor }} />
                    <span className="text-sm font-semibold text-foreground">{stage.nome}</span>
                    <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
                      {dealsByStage[stage.id]?.length || 0}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setDealForm({ titulo: '', valor: '', telefone: '', contato_nome: '', cnpj: '', notas: '' });
                      setNewDealDialog(stage.id);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'p-2 min-h-[200px] space-y-2 transition-colors',
                        snapshot.isDraggingOver && 'bg-primary/5'
                      )}
                    >
                      {dealsByStage[stage.id]?.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openEdit(deal)}
                              className={cn(
                                'bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md transition-shadow',
                                snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30'
                              )}
                            >
                              <p className="text-sm font-medium text-foreground mb-1 line-clamp-2">{deal.titulo}</p>
                              {deal.contato_nome && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <User className="w-3 h-3" /> {deal.contato_nome}
                                </div>
                              )}
                              {deal.valor > 0 && (
                                <div className="flex items-center gap-1 text-xs font-medium text-accent">
                                  <DollarSign className="w-3 h-3" /> R$ {deal.valor.toLocaleString('pt-BR')}
                                </div>
                              )}
                              {deal.telefone && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Phone className="w-3 h-3" /> {deal.telefone}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* New/Edit Deal Dialog */}
      <Dialog open={!!newDealDialog || !!editDealDialog} onOpenChange={() => { setNewDealDialog(null); setEditDealDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editDealDialog ? 'Editar Deal' : 'Novo Deal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título *</label>
              <Input value={dealForm.titulo} onChange={e => setDealForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Nome do deal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <Input type="number" value={dealForm.valor} onChange={e => setDealForm(f => ({ ...f, valor: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <Input value={dealForm.telefone} onChange={e => setDealForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Contato</label>
                <Input value={dealForm.contato_nome} onChange={e => setDealForm(f => ({ ...f, contato_nome: e.target.value }))} placeholder="Nome" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
                <Input value={dealForm.cnpj} onChange={e => setDealForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notas</label>
              <Textarea value={dealForm.notas} onChange={e => setDealForm(f => ({ ...f, notas: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editDealDialog && (
              <Button variant="destructive" size="sm" onClick={() => handleDeleteDeal(editDealDialog.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Remover
              </Button>
            )}
            <Button onClick={editDealDialog ? handleUpdateDeal : handleCreateDeal} disabled={!dealForm.titulo.trim()}>
              {editDealDialog ? 'Salvar' : 'Criar Deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Config Dialog */}
      <PipelineConfigDialog
        open={pipelineDialog}
        onClose={() => setPipelineDialog(false)}
        stages={stages}
        addStage={addStage}
        updateStage={updateStage}
        deleteStage={deleteStage}
      />
    </AppLayout>
  );
}

function PipelineConfigDialog({ open, onClose, stages, addStage, updateStage, deleteStage }: {
  open: boolean;
  onClose: () => void;
  stages: PipelineStage[];
  addStage: any;
  updateStage: any;
  deleteStage: any;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#22c55e', '#ef4444', '#ec4899', '#06b6d4'];

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addStage.mutateAsync({ nome: newName, cor: newColor, posicao: stages.length });
      setNewName('');
      toast.success('Etapa adicionada');
    } catch { toast.error('Erro ao adicionar'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStage.mutateAsync(id);
      toast.success('Etapa removida');
    } catch { toast.error('Erro: Remova os deals desta etapa primeiro'); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Funil de Vendas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.cor }} />
              <Input
                defaultValue={stage.nome}
                className="h-8 text-sm"
                onBlur={e => {
                  if (e.target.value !== stage.nome) {
                    updateStage.mutate({ id: stage.id, nome: e.target.value });
                  }
                }}
              />
              <select
                value={stage.cor}
                onChange={e => updateStage.mutate({ id: stage.id, cor: e.target.value })}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {COLORS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleDelete(stage.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nova etapa..." className="h-9" />
          <select
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            {COLORS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
