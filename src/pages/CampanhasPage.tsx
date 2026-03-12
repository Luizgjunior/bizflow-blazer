import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Send, Plus, FileSpreadsheet, Play, Eye, Loader2, CheckCircle2, XCircle, Clock,
  MessageSquare, Image, ListChecks, BarChart3, Timer, AlertTriangle,
  Download, UserPlus, Trash2, Search, Edit, MoreVertical, Sparkles, Bot, Mail, ShieldCheck
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EmailCampaignsTab from '@/components/EmailCampaignsTab';

/* ── Types ── */
type Campaign = {
  id: string; nome: string; mensagem: string | null; media_url: string | null;
  media_type: string | null; tipo: string; status: string; total_contatos: number;
  enviados: number; falhas: number; created_at: string; started_at: string | null; finished_at: string | null;
};
type CampaignContact = {
  id: string; telefone: string; nome: string | null; cnpj: string | null;
  status: string; error_message: string | null; sent_at: string | null;
};
type ICP = { id: string; nome: string; leadCount?: number };
type ManualContact = { telefone: string; nome: string };

function downloadCsvTemplate() {
  const content = 'telefone;nome\n5511999999999;João Silva\n5521988888888;Maria Santos\n5531977777777;Pedro Oliveira';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'modelo_contatos_whatsapp.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function CampanhasPage() {
  useDocumentTitle('Campanhas');
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<any>(null);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('texto');
  const [mensagem, setMensagem] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [contactSource, setContactSource] = useState<'icp' | 'csv' | 'manual'>('icp');
  const [csvContacts, setCsvContacts] = useState<{ telefone: string; nome: string; cnpj: string }[]>([]);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [icps, setIcps] = useState<ICP[]>([]);
  const [selectedIcps, setSelectedIcps] = useState<string[]>([]);
  const [icpSearch, setIcpSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [loadingIcps, setLoadingIcps] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editMensagem, setEditMensagem] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [useAiVariations, setUseAiVariations] = useState(false);
  const [aiVariations, setAiVariations] = useState<string[]>([]);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showVariationsPreview, setShowVariationsPreview] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);
  const [whatsappCheckResult, setWhatsappCheckResult] = useState<{ valid: number; invalid: number; total: number } | null>(null);

  const tenantId = profile?.tenant_id;

  const fetchCampaigns = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('whatsapp_campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Poll for progress when any campaign is "sending"
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === 'sending');
    if (!hasSending) return;
    const interval = setInterval(fetchCampaigns, 3000);
    return () => clearInterval(interval);
  }, [campaigns, fetchCampaigns]);

  const fetchIcps = useCallback(async () => {
    if (!tenantId) return;
    setLoadingIcps(true);
    const { data: icpData } = await supabase.from('icps').select('id, nome').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (icpData) {
      const icpsWithCounts: ICP[] = [];
      for (const icp of icpData) {
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('run_id', (await supabase.from('runs').select('id').eq('icp_id', icp.id).eq('tenant_id', tenantId)).data?.map(r => r.id) || []);
        icpsWithCounts.push({ ...icp, leadCount: count || 0 });
      }
      setIcps(icpsWithCounts);
    }
    setLoadingIcps(false);
  }, [tenantId]);

  useEffect(() => { if (showCreate && contactSource === 'icp') fetchIcps(); }, [showCreate, contactSource, fetchIcps]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio'); return; }
      const header = lines[0].toLowerCase().split(/[;,]/).map((h) => h.trim());
      const telIdx = header.findIndex((h) => h.includes('telefone') || h.includes('phone') || h.includes('tel'));
      const nomeIdx = header.findIndex((h) => h.includes('nome') || h.includes('name'));
      const cnpjIdx = header.findIndex((h) => h.includes('cnpj'));
      if (telIdx === -1) { toast.error('Coluna "telefone" não encontrada'); return; }
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(/[;,]/).map((c) => c.trim());
        return { telefone: cols[telIdx] || '', nome: nomeIdx >= 0 ? cols[nomeIdx] || '' : '', cnpj: cnpjIdx >= 0 ? cols[cnpjIdx] || '' : '' };
      }).filter((c) => c.telefone);
      setCsvContacts(parsed);
      toast.success(`${parsed.length} contatos importados`);
    };
    reader.readAsText(file);
  };

  const handleAddManualContact = () => {
    const phone = manualPhone.replace(/\D/g, '');
    if (phone.length < 10) { toast.error('Telefone inválido'); return; }
    if (manualContacts.some(c => c.telefone === phone)) { toast.error('Número já adicionado'); return; }
    setManualContacts([...manualContacts, { telefone: phone, nome: manualName.trim() || phone }]);
    setManualPhone(''); setManualName('');
  };

  const handleRemoveManualContact = (phone: string) => setManualContacts(manualContacts.filter(c => c.telefone !== phone));

  const checkWhatsappNumbers = async (phones: string[]): Promise<Set<string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return new Set(phones);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const validNumbers = new Set<string>();
      
      // Process in batches of 50
      for (let i = 0; i < phones.length; i += 50) {
        const batch = phones.slice(i, i + 50);
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/check-whatsapp`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          data.results?.forEach((r: any) => { if (r.has_whatsapp) validNumbers.add(r.number); });
        } else {
          // If check fails, keep all numbers
          batch.forEach(n => validNumbers.add(n));
        }
      }
      return validNumbers;
    } catch {
      return new Set(phones);
    }
  };

  const handleCreate = async () => {
    if (!nome.trim()) { toast.error('Nome da campanha é obrigatório'); return; }
    if (!mensagem.trim() && tipo === 'texto') { toast.error('Mensagem é obrigatória'); return; }
    setCreating(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      if (tipo === 'media' && mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const path = `${tenantId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, mediaFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        mediaType = mediaFile.type.startsWith('image') ? 'image' : mediaFile.type.startsWith('video') ? 'video' : 'document';
      }

      let contactsToInsert: { telefone: string; nome: string | null; cnpj: string | null; lead_id: string | null }[] = [];

      if (contactSource === 'csv') {
        contactsToInsert = csvContacts.map((c) => ({ telefone: c.telefone, nome: c.nome || null, cnpj: c.cnpj || null, lead_id: null }));
      } else if (contactSource === 'manual') {
        contactsToInsert = manualContacts.map((c) => ({ telefone: c.telefone, nome: c.nome || null, cnpj: null, lead_id: null }));
      } else {
        if (selectedIcps.length === 0) { toast.error('Selecione ao menos um ICP'); setCreating(false); return; }
        const { data: runs } = await supabase.from('runs').select('id').eq('tenant_id', tenantId!).in('icp_id', selectedIcps);
        const runIds = runs?.map(r => r.id) || [];
        if (runIds.length === 0) { toast.error('Nenhuma execução encontrada'); setCreating(false); return; }
        const { data: leadsData } = await supabase.from('leads').select('id, razao_social, cnpj, raw_json').eq('tenant_id', tenantId!).in('run_id', runIds);
        contactsToInsert = (leadsData || []).map((l) => {
          const raw = (l as any).raw_json || {};
          const phonesRaw = raw.Telefones || raw.telefones || raw.Telefone || raw.telefone || raw.phones || raw.phone || '';
          let phone = '';
          if (Array.isArray(phonesRaw) && phonesRaw.length > 0) {
            const first = phonesRaw[0];
            phone = typeof first === 'string' ? first : (first?.numero || first?.phone || '');
          } else if (typeof phonesRaw === 'string' && phonesRaw.trim()) {
            phone = phonesRaw.split(',')[0].trim();
          }
          phone = phone.replace(/\D/g, '');
          if (phone.length >= 10 && !phone.startsWith('55')) phone = '55' + phone;
          return { telefone: phone, nome: l.razao_social, cnpj: l.cnpj, lead_id: l.id };
        }).filter((c) => c.telefone && c.telefone.length >= 12);
      }

      if (contactsToInsert.length === 0) { toast.error('Nenhum contato com telefone válido'); setCreating(false); return; }

      // Check WhatsApp numbers
      setCheckingWhatsapp(true);
      toast.info('Verificando números no WhatsApp...');
      const allPhones = contactsToInsert.map(c => c.telefone);
      const validPhones = await checkWhatsappNumbers(allPhones);
      const beforeCount = contactsToInsert.length;
      contactsToInsert = contactsToInsert.filter(c => validPhones.has(c.telefone));
      const invalidCount = beforeCount - contactsToInsert.length;
      setWhatsappCheckResult({ valid: contactsToInsert.length, invalid: invalidCount, total: beforeCount });
      setCheckingWhatsapp(false);

      if (invalidCount > 0) {
        toast.info(`${invalidCount} número(s) sem WhatsApp removidos`);
      }

      if (contactsToInsert.length === 0) { toast.error('Nenhum contato possui WhatsApp válido'); setCreating(false); return; }

      const { data: campaign, error: campErr } = await supabase.from('whatsapp_campaigns')
        .insert({ tenant_id: tenantId!, nome, mensagem, media_url: mediaUrl, media_type: mediaType, tipo, total_contatos: contactsToInsert.length, use_ai_variations: useAiVariations } as any)
        .select().single();
      if (campErr) throw campErr;
      const { error: contactErr } = await supabase.from('whatsapp_campaign_contacts').insert(contactsToInsert.map((c) => ({ campaign_id: campaign.id, ...c })));
      if (contactErr) throw contactErr;
      toast.success(`Campanha criada com ${contactsToInsert.length} contatos válidos!`);
      setShowCreate(false); resetForm(); fetchCampaigns();
    } catch (err: any) { console.error(err); toast.error(err.message || 'Erro ao criar campanha'); }
    finally { setCreating(false); setCheckingWhatsapp(false); }
  };

  const resetForm = () => {
    setNome(''); setTipo('texto'); setMensagem(''); setMediaFile(null);
    setContactSource('icp'); setCsvContacts([]); setSelectedIcps([]);
    setManualContacts([]); setManualPhone(''); setManualName('');
    setUseAiVariations(false); setAiVariations([]); setShowVariationsPreview(false);
    setWhatsappCheckResult(null); setCheckingWhatsapp(false);
  };

  const handleGenerateVariations = async () => {
    if (!mensagem.trim()) { toast.error('Escreva a mensagem antes de gerar variações'); return; }
    setGeneratingAi(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/ai-message-variations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensagem, count: 5 }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setAiVariations(data.variations || []);
      setShowVariationsPreview(true);
      toast.success(`${data.variations?.length || 0} variações geradas!`);
    } catch (err: any) { toast.error(err.message || 'Erro ao gerar variações'); }
    finally { setGeneratingAi(false); }
  };

  const openEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setEditNome(c.nome);
    setEditMensagem(c.mensagem || '');
    setShowEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editingCampaign || !editNome.trim()) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('whatsapp_campaigns')
        .update({ nome: editNome.trim(), mensagem: editMensagem.trim() || null })
        .eq('id', editingCampaign.id);
      if (error) throw error;
      toast.success('Campanha atualizada');
      setShowEditDialog(false);
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message || 'Erro ao atualizar'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (campaignId: string) => {
    setDeleting(true);
    try {
      await supabase.from('whatsapp_campaign_contacts').delete().eq('campaign_id', campaignId);
      const { error } = await supabase.from('whatsapp_campaigns').delete().eq('id', campaignId);
      if (error) throw error;
      toast.success('Campanha excluída');
      setDeleteConfirm(null);
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message || 'Erro ao excluir'); }
    finally { setDeleting(false); }
  };

  const handleSend = async (campaignId: string) => {
    setSending(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      // Fire-and-forget: don't await the response so it continues even if user leaves
      fetch(`https://${projectId}.supabase.co/functions/v1/send-whatsapp`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      }).catch(err => console.error('Send error:', err));
      toast.success('Disparo iniciado! Acompanhe o progresso abaixo.');
      // Start polling for progress
      fetchCampaigns();
    } catch (err: any) { toast.error(err.message || 'Erro ao enviar'); }
    finally { setSending(null); }
  };

  const handleViewDetails = async (campaignId: string) => {
    setShowDetail(campaignId);
    const { data } = await supabase.from('whatsapp_campaign_contacts')
      .select('id, telefone, nome, cnpj, status, error_message, sent_at')
      .eq('campaign_id', campaignId).order('created_at', { ascending: true });
    setContacts((data as CampaignContact[]) || []);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'secondary' }, sending: { label: 'Enviando', variant: 'default' },
      completed: { label: 'Concluída', variant: 'outline' }, failed: { label: 'Falhou', variant: 'destructive' },
      pending: { label: 'Pendente', variant: 'secondary' }, sent: { label: 'Enviado', variant: 'default' },
    };
    const info = map[s] || { label: s, variant: 'secondary' as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const tipoIcon = (t: string) => {
    if (t === 'media') return <Image className="w-3.5 h-3.5" />;
    if (t === 'template') return <ListChecks className="w-3.5 h-3.5" />;
    return <MessageSquare className="w-3.5 h-3.5" />;
  };

  const filteredIcps = icps.filter(i => i.nome.toLowerCase().includes(icpSearch.toLowerCase()));
  const totalSelectedContacts = contactSource === 'csv' ? csvContacts.length
    : contactSource === 'manual' ? manualContacts.length
    : icps.filter(i => selectedIcps.includes(i.id)).reduce((sum, i) => sum + (i.leadCount || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Campanhas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie seus disparos em massa.</p>
        </div>

        <Tabs defaultValue="whatsapp" className="w-full">
          {/* TabsList com aba E-mail ocultada temporariamente - aguardando verificação do domínio Resend */}
          {/*<TabsList className="mb-4">
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="w-4 h-4" /> E-mail
            </TabsTrigger>
          </TabsList>*/}

          <TabsContent value="whatsapp">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Gerencie seus disparos WhatsApp em massa.</p>
                <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs">
                  <Plus className="w-4 h-4" /> Nova Campanha
                </Button>
              </div>

              {/* Campaigns List */}
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : campaigns.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>Criar primeira campanha</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {tipoIcon(c.tipo)}
                            <span className="font-medium text-sm text-foreground truncate">{c.nome}</span>
                            {statusBadge(c.status)}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleViewDetails(c.id)}><Eye className="w-4 h-4" /></Button>
                            {c.status === 'draft' && (
                              <>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(c)}><Edit className="w-4 h-4" /></Button>
                                <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => handleSend(c.id)} disabled={sending === c.id}>
                                  {sending === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                  Enviar
                                </Button>
                              </>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {c.status === 'draft' && <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="w-3.5 h-3.5 mr-2" />Editar</DropdownMenuItem>}
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(c.id)}><Trash2 className="w-3.5 h-3.5 mr-2" />Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{c.total_contatos} contatos</span>
                          <span className="text-primary">{c.enviados} enviados</span>
                          {c.falhas > 0 && <span className="text-destructive">{c.falhas} falhas</span>}
                        </div>
                        {(c.status === 'sending' || c.status === 'completed') && c.total_contatos > 0 && (
                          <Progress value={((c.enviados + c.falhas) / c.total_contatos) * 100} className="mt-2 h-1.5" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="email">
            <EmailCampaignsTab />
          </TabsContent>
        </Tabs>

        {/* Create Campaign Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base">Nova Campanha WhatsApp</DialogTitle>
              <DialogDescription className="text-xs">Configure os detalhes do disparo WhatsApp.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</div>
                  Informações
                </div>
                <div>
                  <Label className="text-xs">Nome da Campanha *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promoção Janeiro" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Mensagem</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">📝 Texto</SelectItem>
                      <SelectItem value="media">📎 Mídia (imagem/vídeo/doc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mensagem *</Label>
                  <Textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setAiVariations([]); }} placeholder="Digite a mensagem..." rows={3} className="mt-1 text-sm" />
                  <p className="text-[10px] text-muted-foreground mt-1">Use {'{nome}'} para personalizar.</p>
                </div>

                {/* AI Variations Toggle */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Variações com IA</p>
                        <p className="text-[10px] text-muted-foreground">Gera mensagens únicas para cada contato</p>
                      </div>
                    </div>
                    <Switch checked={useAiVariations} onCheckedChange={setUseAiVariations} />
                  </div>
                  {useAiVariations && (
                    <div className="space-y-2">
                      <Button type="button" size="sm" variant="outline" className="w-full gap-1.5 text-xs h-8" onClick={handleGenerateVariations} disabled={generatingAi || !mensagem.trim()}>
                        {generatingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                        {generatingAi ? 'Gerando...' : aiVariations.length > 0 ? 'Regenerar Variações' : 'Gerar Prévia de Variações'}
                      </Button>
                      {aiVariations.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-muted-foreground">Prévia ({aiVariations.length} variações):</p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {aiVariations.map((v, i) => (
                              <div key={i} className="text-[11px] text-foreground bg-background rounded-lg p-2 border border-border">
                                <span className="text-primary font-mono text-[9px] mr-1">#{i + 1}</span> {v}
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground italic">
                            💡 Ao disparar, a IA gerará uma variação única para cada contato automaticamente.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {tipo === 'media' && (
                  <div>
                    <Label className="text-xs">Arquivo de Mídia</Label>
                    <Input type="file" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} accept="image/*,video/*,.pdf,.doc,.docx" className="mt-1" />
                  </div>
                )}
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</div>
                  Contatos
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'icp' as const, icon: Search, label: 'ICPs' },
                    { key: 'manual' as const, icon: UserPlus, label: 'Manual' },
                    { key: 'csv' as const, icon: FileSpreadsheet, label: 'Planilha' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button key={key} type="button" onClick={() => setContactSource(key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs ${
                        contactSource === key ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                      }`}>
                      <Icon className="w-5 h-5" /><span className="font-medium">{label}</span>
                    </button>
                  ))}
                </div>

                {/* ICP */}
                {contactSource === 'icp' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Selecionar ICPs ({selectedIcps.length})</Label>
                    {icps.length > 3 && <Input placeholder="Buscar ICP..." value={icpSearch} onChange={(e) => setIcpSearch(e.target.value)} className="h-8 text-xs" />}
                    <div className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-1 bg-card">
                      {loadingIcps ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                        : filteredIcps.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">{icps.length === 0 ? 'Nenhum ICP. Crie um primeiro.' : 'Sem resultados.'}</p>
                        : filteredIcps.map((icp) => (
                          <label key={icp.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${selectedIcps.includes(icp.id) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'}`}>
                            <Checkbox checked={selectedIcps.includes(icp.id)} onCheckedChange={(checked) => { if (checked) setSelectedIcps([...selectedIcps, icp.id]); else setSelectedIcps(selectedIcps.filter(id => id !== icp.id)); }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{icp.nome}</p>
                              <p className="text-[10px] text-muted-foreground">{icp.leadCount || 0} leads</p>
                            </div>
                          </label>
                        ))}
                    </div>
                    {filteredIcps.length > 1 && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIcps(filteredIcps.map(i => i.id))}>Selecionar todos</Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIcps([])}>Limpar</Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual */}
                {contactSource === 'manual' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input placeholder="Telefone (5511...)" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} className="h-9 text-xs flex-1" onKeyDown={(e) => e.key === 'Enter' && handleAddManualContact()} />
                      <Input placeholder="Nome (opc.)" value={manualName} onChange={(e) => setManualName(e.target.value)} className="h-9 text-xs flex-1" onKeyDown={(e) => e.key === 'Enter' && handleAddManualContact()} />
                      <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={handleAddManualContact}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {manualContacts.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1 bg-card">
                        {manualContacts.map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <div className="min-w-0"><p className="text-xs font-medium text-foreground truncate">{c.nome}</p><p className="text-[10px] text-muted-foreground font-mono">{c.telefone}</p></div>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleRemoveManualContact(c.telefone)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 border rounded-xl border-dashed border-muted-foreground/20">
                        <UserPlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Adicione números manualmente</p>
                      </div>
                    )}
                  </div>
                )}

                {/* CSV */}
                {contactSource === 'csv' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8" onClick={downloadCsvTemplate}><Download className="w-3.5 h-3.5" /> Baixar Modelo</Button>
                      <span className="text-[10px] text-muted-foreground">Use como base</span>
                    </div>
                    <Input type="file" accept=".csv" onChange={handleCsvUpload} className="text-xs" />
                    <div className="p-3 rounded-xl bg-muted/30 border border-border">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        <strong>Formato:</strong> CSV com <code className="bg-muted px-1 rounded">;</code> ou <code className="bg-muted px-1 rounded">,</code><br />
                        <strong>Colunas:</strong> <code className="bg-muted px-1 rounded">telefone</code> (obrig.), <code className="bg-muted px-1 rounded">nome</code> e <code className="bg-muted px-1 rounded">cnpj</code> (opcionais)
                      </p>
                    </div>
                    {csvContacts.length > 0 && <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="w-3 h-3" />{csvContacts.length} contatos importados</Badge>}
                  </div>
                )}

                {totalSelectedContacts > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs text-primary font-medium">{totalSelectedContacts} contato{totalSelectedContacts > 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>

              <Button onClick={handleCreate} disabled={creating} className="w-full gap-2 h-11">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Criar Campanha
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base">Detalhes da Campanha</DialogTitle>
              <DialogDescription className="text-xs">Status por contato.</DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Telefone</TableHead><TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs hidden sm:table-cell">Enviado em</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono">{c.telefone}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{c.nome || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {c.status === 'sent' && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                          {c.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                          {c.status === 'pending' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                          {statusBadge(c.status)}
                        </div>
                        {c.error_message && <p className="text-[10px] text-destructive mt-0.5">{c.error_message}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Dialog */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base"><BarChart3 className="w-5 h-5 text-primary" /> Relatório</DialogTitle>
              <DialogDescription className="text-xs">{report?.campaign_name || 'Campanha'}</DialogDescription>
            </DialogHeader>
            {report && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center"><p className="text-xl font-bold text-primary">{report.enviados}</p><p className="text-[10px] text-muted-foreground">Enviados</p></div>
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center"><p className="text-xl font-bold text-destructive">{report.falhas}</p><p className="text-[10px] text-muted-foreground">Falhas</p></div>
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-center"><p className="text-xl font-bold text-accent">{report.success_rate}%</p><p className="text-[10px] text-muted-foreground">Sucesso</p></div>
                  <div className="p-3 rounded-xl bg-muted border border-border text-center"><p className="text-xl font-bold text-foreground">{report.total_contacts}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
                </div>
                <Card><CardContent className="p-3">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-2"><Timer className="w-4 h-4 text-primary" /> Tempo</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Duração:</span> <span className="font-medium text-foreground">{report.duration_seconds >= 60 ? `${Math.floor(report.duration_seconds / 60)}min ${report.duration_seconds % 60}s` : `${report.duration_seconds}s`}</span></div>
                    <div><span className="text-muted-foreground">Intervalo médio:</span> <span className="font-medium text-foreground">{report.delay_stats?.avg_seconds}s</span></div>
                    <div><span className="text-muted-foreground">Início:</span> <span className="font-medium text-foreground">{new Date(report.started_at).toLocaleString('pt-BR')}</span></div>
                    <div><span className="text-muted-foreground">Fim:</span> <span className="font-medium text-foreground">{new Date(report.finished_at).toLocaleString('pt-BR')}</span></div>
                  </div>
                </CardContent></Card>
                {report.contacts?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2">Por Contato</h4>
                    <div className="max-h-48 overflow-y-auto border rounded-xl overflow-x-auto">
                      <Table><TableHeader><TableRow>
                        <TableHead className="text-xs">Telefone</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Intervalo</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>{report.contacts.map((c: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono">{c.telefone}</TableCell>
                          <TableCell><div className="flex items-center gap-1">{c.status === 'sent' ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3 text-destructive" />}<span className={`text-xs ${c.status === 'sent' ? 'text-primary' : 'text-destructive'}`}>{c.status === 'sent' ? 'OK' : 'Falhou'}</span></div>{c.error && <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5"><AlertTriangle className="w-2.5 h-2.5" />{c.error}</p>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.delay_ms > 0 ? `${Math.round(c.delay_ms / 1000)}s` : '-'}</TableCell>
                        </TableRow>
                      ))}</TableBody></Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Campaign Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base">Editar Campanha</DialogTitle>
              <DialogDescription className="text-xs">Altere o nome ou a mensagem.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea value={editMensagem} onChange={(e) => setEditMensagem(e.target.value)} rows={3} className="mt-1 text-sm" />
              </div>
              <Button onClick={handleEditSave} disabled={editSaving} className="w-full gap-2">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação é irreversível. Todos os contatos associados serão removidos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
