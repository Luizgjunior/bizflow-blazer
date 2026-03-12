import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Smartphone, Wifi, WifiOff, QrCode, Loader2 } from 'lucide-react';

export default function DisparosPage() {
  useDocumentTitle('Conexão WhatsApp');

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
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Conexão WhatsApp</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Conecte seu WhatsApp Business para disparos e chat.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="w-5 h-5 text-primary" /> Status da Conexão
            </CardTitle>
            <CardDescription className="text-xs">Gerencie a conexão do seu WhatsApp Business.</CardDescription>
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
            <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/10">
              <p className="text-xs text-muted-foreground">
                <strong>Dica:</strong> Use uma conta WhatsApp Business para maior estabilidade e evitar bloqueios.
              </p>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base"><QrCode className="w-5 h-5 text-primary" /> Escanear QR Code</DialogTitle>
              <DialogDescription className="text-xs">WhatsApp → Configurações → Aparelhos Conectados → Conectar</DialogDescription>
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
    </AppLayout>
  );
}
