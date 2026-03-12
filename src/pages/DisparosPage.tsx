import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Smartphone, Wifi, WifiOff, QrCode, Send, Plus, Upload,
  FileSpreadsheet, Play, Eye, Loader2, CheckCircle2, XCircle, Clock,
  MessageSquare, Image, ListChecks, BarChart3, Timer, AlertTriangle,
  Download, UserPlus, Trash2, Search
} from 'lucide-react';

/* ── Types ── */
type Campaign = {
  id: string;
  nome: string;
  mensagem: string | null;
  media_url: string | null;
  media_type: string | null;
  tipo: string;
  status: string;
  total_contatos: number;
  enviados: number;
  falhas: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type CampaignContact = {
  id: string;
  telefone: string;
  nome: string | null;
  cnpj: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

type ICP = {
  id: string;
  nome: string;
  leadCount?: number;
};

type ManualContact = {
  telefone: string;
  nome: string;
};

/* ── WhatsApp Connection Tab ── */
function WhatsAppTab() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-instance?action=status`,
        { headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      setStatus(data.status || 'disconnected');
      setPhoneNumber(data.phone_number || '');
      if (data.status === 'connected') { setShowQrDialog(false); setPolling(false); }
    } catch (err) { console.error('Status check error:', err); }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [polling, checkStatus]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-instance?action=connect`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (data.status === 'connected') {
        setStatus('connected'); setPhoneNumber(data.phone_number || ''); toast.success('WhatsApp já está conectado!');
      } else if (data.qr_code) {
        setQrCode(typeof data.qr_code === 'string' ? data.qr_code : JSON.stringify(data.qr_code));
        setShowQrDialog(true); setPolling(true); setStatus('connecting');
      } else { toast.error('Não foi possível gerar o QR Code. Tente novamente.'); }
    } catch (err) { console.error(err); toast.error('Erro ao conectar WhatsApp'); }
    finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/whatsapp-instance?action=disconnect`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } });
      setStatus('disconnected'); setPhoneNumber(''); toast.success('WhatsApp desconectado');
    } catch (err) { toast.error('Erro ao desconectar'); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="w-5 h-5 text-primary" />
            Conexão WhatsApp
          </CardTitle>
          <CardDescription className="text-xs">
            Conecte seu WhatsApp Business para enviar disparos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status === 'connected' ? 'bg-primary/10' : 'bg-muted'}`}>
                {status === 'connected' ? <Wifi className="w-5 h-5 text-primary" /> : <WifiOff className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">
                  {status === 'connected' ? 'Conectado' : status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </p>
                {phoneNumber && <p className="text-xs text-muted-foreground">+{phoneNumber}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {status === 'connected' ? (
                <Button variant="outline" size="sm" onClick={handleDisconnect}>Desconectar</Button>
              ) : (
                <Button size="sm" onClick={handleConnect} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <QrCode className="w-4 h-4 mr-1" />}
                  Conectar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <QrCode className="w-5 h-5 text-primary" /> Escanear QR Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              WhatsApp → Configurações → Aparelhos Conectados → Conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <div className="p-3 bg-white rounded-xl">
                <img src={typeof qrCode === 'string' ? (qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`) : ''} alt="QR Code" className="w-56 h-56 sm:w-64 sm:h-64" />
              </div>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center bg-muted rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Aguardando leitura...
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── CSV Template Helper ── */
function downloadCsvTemplate() {
  const content = 'telefone;nome\n5511999999999;João Silva\n5521988888888;Maria Santos\n5531977777777;Pedro Oliveira';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_contatos_whatsapp.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Campaigns Tab ── */
function CampaignsTab() {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<any>(null);

  // Create form state
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

  const tenantId = profile?.tenant_id;

  const fetchCampaigns = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const fetchIcps = useCallback(async () => {
    if (!tenantId) return;
    setLoadingIcps(true);
    const { data: icpData } = await supabase
      .from('icps')
      .select('id, nome')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (icpData) {
      // Count leads per ICP (only API leads that have a run_id)
      const icpsWithCounts: ICP[] = [];
      for (const icp of icpData) {
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('run_id', (
            await supabase
              .from('runs')
              .select('id')
              .eq('icp_id', icp.id)
              .eq('tenant_id', tenantId)
          ).data?.map(r => r.id) || []);
        icpsWithCounts.push({ ...icp, leadCount: count || 0 });
      }
      setIcps(icpsWithCounts);
    }
    setLoadingIcps(false);
  }, [tenantId]);

  useEffect(() => {
    if (showCreate && contactSource === 'icp') {
      fetchIcps();
    }
  }, [showCreate, contactSource, fetchIcps]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) { toast.error('Arquivo CSV vazio ou sem dados'); return; }
      const header = lines[0].toLowerCase().split(/[;,]/).map((h) => h.trim());
      const telIdx = header.findIndex((h) => h.includes('telefone') || h.includes('phone') || h.includes('tel'));
      const nomeIdx = header.findIndex((h) => h.includes('nome') || h.includes('name'));
      const cnpjIdx = header.findIndex((h) => h.includes('cnpj'));
      if (telIdx === -1) { toast.error('Coluna "telefone" não encontrada no CSV'); return; }
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
    if (phone.length < 10) { toast.error('Telefone inválido (mínimo 10 dígitos)'); return; }
    if (manualContacts.some(c => c.telefone === phone)) { toast.error('Número já adicionado'); return; }
    setManualContacts([...manualContacts, { telefone: phone, nome: manualName.trim() || phone }]);
    setManualPhone('');
    setManualName('');
  };

  const handleRemoveManualContact = (phone: string) => {
    setManualContacts(manualContacts.filter(c => c.telefone !== phone));
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
        // From ICPs - get all leads from selected ICPs via their runs
        if (selectedIcps.length === 0) { toast.error('Selecione ao menos um ICP'); setCreating(false); return; }
        
        // Get run IDs for selected ICPs
        const { data: runs } = await supabase
          .from('runs')
          .select('id')
          .eq('tenant_id', tenantId!)
          .in('icp_id', selectedIcps);

        const runIds = runs?.map(r => r.id) || [];

        if (runIds.length === 0) { toast.error('Nenhuma execução encontrada para os ICPs selecionados'); setCreating(false); return; }

        // Get leads from those runs (API leads only)
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, razao_social, cnpj, raw_json')
          .eq('tenant_id', tenantId!)
          .in('run_id', runIds);

        contactsToInsert = (leadsData || []).map((l) => {
          const raw = (l as any).raw_json || {};
          const phones = raw.telefones || raw.phones || [];
          const phone = Array.isArray(phones) && phones.length > 0 ? phones[0] : '';
          return {
            telefone: typeof phone === 'string' ? phone : (phone?.numero || phone?.phone || ''),
            nome: l.razao_social,
            cnpj: l.cnpj,
            lead_id: l.id,
          };
        }).filter((c) => c.telefone);
      }

      if (contactsToInsert.length === 0) { toast.error('Nenhum contato com telefone válido'); setCreating(false); return; }

      const { data: campaign, error: campErr } = await supabase
        .from('whatsapp_campaigns')
        .insert({ tenant_id: tenantId!, nome, mensagem, media_url: mediaUrl, media_type: mediaType, tipo, total_contatos: contactsToInsert.length })
        .select()
        .single();
      if (campErr) throw campErr;

      const contactRows = contactsToInsert.map((c) => ({ campaign_id: campaign.id, ...c }));
      const { error: contactErr } = await supabase.from('whatsapp_campaign_contacts').insert(contactRows);
      if (contactErr) throw contactErr;

      toast.success(`Campanha criada com ${contactsToInsert.length} contatos!`);
      setShowCreate(false);
      resetForm();
      fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao criar campanha');
    } finally { setCreating(false); }
  };

  const resetForm = () => {
    setNome(''); setTipo('texto'); setMensagem(''); setMediaFile(null);
    setContactSource('icp'); setCsvContacts([]); setSelectedIcps([]);
    setManualContacts([]); setManualPhone(''); setManualName('');
  };

  const handleSend = async (campaignId: string) => {
    setSending(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); }
      else { setReport(data); setShowReport(true); toast.success(`Campanha finalizada: ${data.enviados} enviados, ${data.falhas} falhas`); fetchCampaigns(); }
    } catch (err: any) { toast.error(err.message || 'Erro ao enviar'); }
    finally { setSending(null); }
  };

  const handleViewDetails = async (campaignId: string) => {
    setShowDetail(campaignId);
    const { data } = await supabase
      .from('whatsapp_campaign_contacts')
      .select('id, telefone, nome, cnpj, status, error_message, sent_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });
    setContacts((data as CampaignContact[]) || []);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'secondary' },
      sending: { label: 'Enviando', variant: 'default' },
      completed: { label: 'Concluída', variant: 'outline' },
      failed: { label: 'Falhou', variant: 'destructive' },
      pending: { label: 'Pendente', variant: 'secondary' },
      sent: { label: 'Enviado', variant: 'default' },
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

  const totalSelectedContacts = contactSource === 'csv'
    ? csvContacts.length
    : contactSource === 'manual'
      ? manualContacts.length
      : icps.filter(i => selectedIcps.includes(i.id)).reduce((sum, i) => sum + (i.leadCount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">Campanhas de Disparo</h3>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> Nova Campanha
        </Button>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
              Criar primeira campanha
            </Button>
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
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleViewDetails(c.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {c.status === 'draft' && (
                      <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => handleSend(c.id)} disabled={sending === c.id}>
                        {sending === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Enviar
                      </Button>
                    )}
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

      {/* ── Create Campaign Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">Nova Campanha</DialogTitle>
            <DialogDescription className="text-xs">Configure os detalhes do disparo WhatsApp.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Step 1: Basic Info */}
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
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite a mensagem que será enviada..."
                  rows={3}
                  className="mt-1 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Use {'{nome}'} para personalizar com o nome do contato.
                </p>
              </div>
              {tipo === 'media' && (
                <div>
                  <Label className="text-xs">Arquivo de Mídia</Label>
                  <Input type="file" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} accept="image/*,video/*,.pdf,.doc,.docx" className="mt-1" />
                </div>
              )}
            </div>

            {/* Step 2: Contact Source */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</div>
                Contatos
              </div>

              {/* Source Selector - Mobile-friendly buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setContactSource('icp')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs ${
                    contactSource === 'icp' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  <Search className="w-5 h-5" />
                  <span className="font-medium">ICPs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactSource('manual')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs ${
                    contactSource === 'manual' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="font-medium">Manual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactSource('csv')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs ${
                    contactSource === 'csv' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span className="font-medium">Planilha</span>
                </button>
              </div>

              {/* ICP Selection */}
              {contactSource === 'icp' && (
                <div className="space-y-2">
                  <Label className="text-xs">Selecionar ICPs ({selectedIcps.length} selecionados)</Label>
                  {icps.length > 3 && (
                    <Input
                      placeholder="Buscar ICP..."
                      value={icpSearch}
                      onChange={(e) => setIcpSearch(e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
                  <div className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-1 bg-card">
                    {loadingIcps ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredIcps.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {icps.length === 0 ? 'Nenhum ICP encontrado. Crie um ICP primeiro.' : 'Nenhum resultado para a busca.'}
                      </p>
                    ) : (
                      filteredIcps.map((icp) => (
                        <label
                          key={icp.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            selectedIcps.includes(icp.id) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                          }`}
                        >
                          <Checkbox
                            checked={selectedIcps.includes(icp.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedIcps([...selectedIcps, icp.id]);
                              else setSelectedIcps(selectedIcps.filter(id => id !== icp.id));
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{icp.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{icp.leadCount || 0} leads com telefone</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {filteredIcps.length > 1 && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIcps(filteredIcps.map(i => i.id))}>
                        Selecionar todos
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIcps([])}>
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Input */}
              {contactSource === 'manual' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Telefone (ex: 5511999999999)"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="h-9 text-xs"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddManualContact()}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Nome (opcional)"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="h-9 text-xs"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddManualContact()}
                      />
                    </div>
                    <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={handleAddManualContact}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {manualContacts.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1 bg-card">
                      {manualContacts.map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{c.nome}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{c.telefone}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleRemoveManualContact(c.telefone)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {manualContacts.length === 0 && (
                    <div className="text-center py-4 border rounded-xl border-dashed border-muted-foreground/20">
                      <UserPlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Adicione números manualmente</p>
                    </div>
                  )}
                </div>
              )}

              {/* CSV Upload */}
              {contactSource === 'csv' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8" onClick={downloadCsvTemplate}>
                      <Download className="w-3.5 h-3.5" /> Baixar Modelo
                    </Button>
                    <span className="text-[10px] text-muted-foreground">Use o modelo como base</span>
                  </div>

                  <div className="relative">
                    <Input type="file" accept=".csv" onChange={handleCsvUpload} className="text-xs" />
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <strong>Formato aceito:</strong> CSV com separador <code className="bg-muted px-1 rounded">;</code> ou <code className="bg-muted px-1 rounded">,</code><br />
                      <strong>Colunas:</strong> <code className="bg-muted px-1 rounded">telefone</code> (obrigatória), <code className="bg-muted px-1 rounded">nome</code> (opcional), <code className="bg-muted px-1 rounded">cnpj</code> (opcional)
                    </p>
                  </div>

                  {csvContacts.length > 0 && (
                    <Badge variant="secondary" className="gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      {csvContacts.length} contatos importados
                    </Badge>
                  )}
                </div>
              )}

              {/* Contact Count Summary */}
              {totalSelectedContacts > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    {totalSelectedContacts} contato{totalSelectedContacts > 1 ? 's' : ''} selecionado{totalSelectedContacts > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Create Button */}
            <Button onClick={handleCreate} disabled={creating} className="w-full gap-2 h-11">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Criar Campanha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">Detalhes da Campanha</DialogTitle>
            <DialogDescription className="text-xs">Status de envio por contato.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Telefone</TableHead>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Enviado em</TableHead>
                </TableRow>
              </TableHeader>
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
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                      {c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5 text-primary" /> Relatório
            </DialogTitle>
            <DialogDescription className="text-xs">{report?.campaign_name || 'Campanha'}</DialogDescription>
          </DialogHeader>
          {report && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <p className="text-xl font-bold text-primary">{report.enviados}</p>
                  <p className="text-[10px] text-muted-foreground">Enviados</p>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                  <p className="text-xl font-bold text-destructive">{report.falhas}</p>
                  <p className="text-[10px] text-muted-foreground">Falhas</p>
                </div>
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-center">
                  <p className="text-xl font-bold text-accent">{report.success_rate}%</p>
                  <p className="text-[10px] text-muted-foreground">Sucesso</p>
                </div>
                <div className="p-3 rounded-xl bg-muted border border-border text-center">
                  <p className="text-xl font-bold text-foreground">{report.total_contacts}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </div>
              <Card>
                <CardContent className="p-3">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-2">
                    <Timer className="w-4 h-4 text-primary" /> Tempo
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Duração:</span> <span className="font-medium text-foreground">{report.duration_seconds >= 60 ? `${Math.floor(report.duration_seconds / 60)}min ${report.duration_seconds % 60}s` : `${report.duration_seconds}s`}</span></div>
                    <div><span className="text-muted-foreground">Intervalo médio:</span> <span className="font-medium text-foreground">{report.delay_stats?.avg_seconds}s</span></div>
                    <div><span className="text-muted-foreground">Início:</span> <span className="font-medium text-foreground">{new Date(report.started_at).toLocaleString('pt-BR')}</span></div>
                    <div><span className="text-muted-foreground">Fim:</span> <span className="font-medium text-foreground">{new Date(report.finished_at).toLocaleString('pt-BR')}</span></div>
                  </div>
                </CardContent>
              </Card>
              {report.contacts?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Detalhes por Contato</h4>
                  <div className="max-h-48 overflow-y-auto border rounded-xl overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Telefone</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Intervalo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.contacts.map((c: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-mono">{c.telefone}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {c.status === 'sent' ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3 text-destructive" />}
                                <span className={`text-xs ${c.status === 'sent' ? 'text-primary' : 'text-destructive'}`}>
                                  {c.status === 'sent' ? 'OK' : 'Falhou'}
                                </span>
                              </div>
                              {c.error && <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5"><AlertTriangle className="w-2.5 h-2.5" />{c.error}</p>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.delay_ms > 0 ? `${Math.round(c.delay_ms / 1000)}s` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Main Page ── */
export default function DisparosPage() {
  useDocumentTitle('Disparos WhatsApp');

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Disparos WhatsApp</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Conecte seu WhatsApp e envie mensagens em massa.
          </p>
        </div>

        <Tabs defaultValue="campanhas" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="campanhas" className="gap-1.5 text-xs">
              <Send className="w-3.5 h-3.5" /> Campanhas
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
              <Smartphone className="w-3.5 h-3.5" /> Conexão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas">
            <CampaignsTab />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
