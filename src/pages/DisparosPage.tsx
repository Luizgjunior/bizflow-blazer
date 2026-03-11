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
import { toast } from 'sonner';
import {
  Smartphone, Wifi, WifiOff, QrCode, Send, Plus, Upload,
  FileSpreadsheet, Play, Eye, Loader2, CheckCircle2, XCircle, Clock,
  MessageSquare, Image, ListChecks
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
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      setStatus(data.status || 'disconnected');
      setPhoneNumber(data.phone_number || '');

      if (data.status === 'connected') {
        setShowQrDialog(false);
        setPolling(false);
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

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
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.status === 'connected') {
        setStatus('connected');
        setPhoneNumber(data.phone_number || '');
        toast.success('WhatsApp já está conectado!');
      } else if (data.qr_code) {
        setQrCode(data.qr_code);
        setShowQrDialog(true);
        setPolling(true);
        setStatus('connecting');
      } else {
        toast.error('Não foi possível gerar o QR Code. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao conectar WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-instance?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setStatus('disconnected');
      setPhoneNumber('');
      toast.success('WhatsApp desconectado');
    } catch (err) {
      toast.error('Erro ao desconectar');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="w-5 h-5 text-primary" />
            Conexão WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte seu WhatsApp Business para enviar disparos em massa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              {status === 'connected' ? (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-primary" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium text-foreground text-sm">
                  {status === 'connected' ? 'Conectado' : status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </p>
                {phoneNumber && (
                  <p className="text-xs text-muted-foreground">+{phoneNumber}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {status === 'connected' ? (
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              ) : (
                <Button size="sm" onClick={handleConnect} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <QrCode className="w-4 h-4 mr-1" />}
                  Conectar WhatsApp
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/10">
            <p className="text-xs text-muted-foreground">
              <strong>Dica:</strong> Use uma conta WhatsApp Business para maior estabilidade e evitar bloqueios. 
              Ao clicar em "Conectar", escaneie o QR Code com seu celular.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Escanear QR Code
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular → Configurações → Aparelhos Conectados → Conectar → Escanear o QR Code abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <div className="p-4 bg-white rounded-xl">
                <img
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Aguardando leitura do QR Code...
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Campaigns Tab ── */
function CampaignsTab() {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);

  // Create form state
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('texto');
  const [mensagem, setMensagem] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [contactSource, setContactSource] = useState<'leads' | 'csv'>('leads');
  const [csvContacts, setCsvContacts] = useState<{ telefone: string; nome: string; cnpj: string }[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [leads, setLeads] = useState<{ id: string; razao_social: string; cnpj: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

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

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const fetchLeads = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('leads')
      .select('id, razao_social, cnpj, raw_json')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    setLeads(data || []);
  }, [tenantId]);

  useEffect(() => {
    if (showCreate && contactSource === 'leads') {
      fetchLeads();
    }
  }, [showCreate, contactSource, fetchLeads]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error('Arquivo CSV vazio ou sem dados');
        return;
      }

      const header = lines[0].toLowerCase().split(/[;,]/).map((h) => h.trim());
      const telIdx = header.findIndex((h) => h.includes('telefone') || h.includes('phone') || h.includes('tel'));
      const nomeIdx = header.findIndex((h) => h.includes('nome') || h.includes('name'));
      const cnpjIdx = header.findIndex((h) => h.includes('cnpj'));

      if (telIdx === -1) {
        toast.error('Coluna "telefone" não encontrada no CSV');
        return;
      }

      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(/[;,]/).map((c) => c.trim());
        return {
          telefone: cols[telIdx] || '',
          nome: nomeIdx >= 0 ? cols[nomeIdx] || '' : '',
          cnpj: cnpjIdx >= 0 ? cols[cnpjIdx] || '' : '',
        };
      }).filter((c) => c.telefone);

      setCsvContacts(parsed);
      toast.success(`${parsed.length} contatos importados`);
    };
    reader.readAsText(file);
  };

  const handleCreate = async () => {
    if (!nome.trim()) {
      toast.error('Nome da campanha é obrigatório');
      return;
    }
    if (!mensagem.trim() && tipo === 'texto') {
      toast.error('Mensagem é obrigatória');
      return;
    }

    setCreating(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Upload media if needed
      if (tipo === 'media' && mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const path = `${tenantId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('whatsapp-media')
          .upload(path, mediaFile);

        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        mediaType = mediaFile.type.startsWith('image') ? 'image' : mediaFile.type.startsWith('video') ? 'video' : 'document';
      }

      // Determine contacts
      let contactsToInsert: { telefone: string; nome: string | null; cnpj: string | null; lead_id: string | null }[] = [];

      if (contactSource === 'csv') {
        contactsToInsert = csvContacts.map((c) => ({
          telefone: c.telefone,
          nome: c.nome || null,
          cnpj: c.cnpj || null,
          lead_id: null,
        }));
      } else {
        // From leads - extract phone from raw_json
        const selectedLeadData = leads.filter((l) => selectedLeads.includes(l.id));
        contactsToInsert = selectedLeadData.map((l) => {
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

      if (contactsToInsert.length === 0) {
        toast.error('Nenhum contato com telefone válido');
        setCreating(false);
        return;
      }

      // Create campaign
      const { data: campaign, error: campErr } = await supabase
        .from('whatsapp_campaigns')
        .insert({
          tenant_id: tenantId!,
          nome,
          mensagem,
          media_url: mediaUrl,
          media_type: mediaType,
          tipo,
          total_contatos: contactsToInsert.length,
        })
        .select()
        .single();

      if (campErr) throw campErr;

      // Insert contacts
      const contactRows = contactsToInsert.map((c) => ({
        campaign_id: campaign.id,
        ...c,
      }));

      const { error: contactErr } = await supabase
        .from('whatsapp_campaign_contacts')
        .insert(contactRows);

      if (contactErr) throw contactErr;

      toast.success('Campanha criada com sucesso!');
      setShowCreate(false);
      resetForm();
      fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao criar campanha');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNome('');
    setTipo('texto');
    setMensagem('');
    setMediaFile(null);
    setContactSource('leads');
    setCsvContacts([]);
    setSelectedLeads([]);
  };

  const handleSend = async (campaignId: string) => {
    setSending(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id: campaignId }),
        }
      );

      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Campanha finalizada: ${data.enviados} enviados, ${data.falhas} falhas`);
        fetchCampaigns();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    } finally {
      setSending(null);
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Campanhas de Disparo</h3>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
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
          <CardContent className="py-12 text-center">
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
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {tipoIcon(c.tipo)}
                    <span className="font-medium text-sm text-foreground">{c.nome}</span>
                    {statusBadge(c.status)}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleViewDetails(c.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {c.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleSend(c.id)}
                        disabled={sending === c.id}
                      >
                        {sending === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Play className="w-4 h-4 mr-1" />
                        )}
                        Enviar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{c.total_contatos} contatos</span>
                  <span className="text-primary">{c.enviados} enviados</span>
                  <span className="text-destructive">{c.falhas} falhas</span>
                </div>

                {(c.status === 'sending' || c.status === 'completed') && c.total_contatos > 0 && (
                  <Progress
                    value={((c.enviados + c.falhas) / c.total_contatos) * 100}
                    className="mt-2 h-1.5"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Configure os detalhes do disparo WhatsApp.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome da Campanha</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promoção Janeiro" />
            </div>

            <div>
              <Label>Tipo de Mensagem</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="media">Mídia (imagem/vídeo/doc)</SelectItem>
                  <SelectItem value="template">Template (lista)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={4}
              />
            </div>

            {tipo === 'media' && (
              <div>
                <Label>Arquivo de Mídia</Label>
                <Input type="file" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} accept="image/*,video/*,.pdf,.doc,.docx" />
              </div>
            )}

            <div>
              <Label>Origem dos Contatos</Label>
              <Select value={contactSource} onValueChange={(v) => setContactSource(v as 'leads' | 'csv')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">Leads Prospectados</SelectItem>
                  <SelectItem value="csv">Upload de Planilha (CSV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {contactSource === 'csv' ? (
              <div>
                <Label>Arquivo CSV</Label>
                <Input type="file" accept=".csv" onChange={handleCsvUpload} />
                <p className="text-xs text-muted-foreground mt-1">
                  Colunas obrigatórias: telefone. Opcionais: nome, cnpj.
                </p>
                {csvContacts.length > 0 && (
                  <Badge variant="secondary" className="mt-2">
                    {csvContacts.length} contatos importados
                  </Badge>
                )}
              </div>
            ) : (
              <div>
                <Label>Selecionar Leads ({selectedLeads.length} selecionados)</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1 mt-1">
                  {leads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum lead encontrado</p>
                  ) : (
                    leads.map((lead) => (
                      <label key={lead.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeads([...selectedLeads, lead.id]);
                            } else {
                              setSelectedLeads(selectedLeads.filter((id) => id !== lead.id));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="truncate">{lead.razao_social}</span>
                        <span className="text-muted-foreground">{lead.cnpj}</span>
                      </label>
                    ))
                  )}
                </div>
                {leads.length > 0 && (
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setSelectedLeads(leads.map((l) => l.id))}
                    >
                      Selecionar todos
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setSelectedLeads([])}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar Campanha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
            <DialogDescription>Status de envio de cada contato.</DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs font-mono">{c.telefone}</TableCell>
                  <TableCell className="text-xs">{c.nome || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {c.status === 'sent' && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      {c.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                      {c.status === 'pending' && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                      {statusBadge(c.status)}
                    </div>
                    {c.error_message && (
                      <p className="text-[10px] text-destructive mt-0.5">{c.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.sent_at ? new Date(c.sent_at).toLocaleString('pt-BR') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Disparos WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte seu WhatsApp e envie mensagens em massa para seus leads.
          </p>
        </div>

        <Tabs defaultValue="whatsapp" className="w-full">
          <TabsList>
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Campanhas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp">
            <WhatsAppTab />
          </TabsContent>

          <TabsContent value="campanhas">
            <CampaignsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
