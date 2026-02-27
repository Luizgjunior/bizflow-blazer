import { useState } from 'react';
import { Webhook, Copy, Check, Shield, Info, CreditCard, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CaktoWebhookPage() {
  const [copied, setCopied] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/webhook-cakto`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const examplePayload = JSON.stringify({
    secret: "seu-secret-aqui",
    event: "purchase_approved",
    data: {
      id: "81b408ee-2a91-427d-80bd-226cbeae1fa0",
      customer: {
        name: "João Silva",
        email: "joao@empresa.com",
        phone: "11999999999"
      },
      offer: { id: "B8BcHrY", name: "Plano Pro", price: 97.00 },
      product: { name: "LeadFlow Pro", type: "subscription" },
      status: "paid",
      amount: 97.00,
      paymentMethod: "credit_card"
    }
  }, null, 2);

  return (
    <AppLayout>
      <PageHeader
        title="Integração Cakto"
        description="Gerencie assinaturas e libere acesso automaticamente"
      />

      <div className="space-y-6 max-w-2xl">
        {/* Webhook URL */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">URL do Webhook</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole esta URL no painel da Cakto em <strong>Apps → Webhooks → Adicionar</strong>. 
            Selecione os eventos: <strong>Compra aprovada</strong>, <strong>Reembolso</strong>, <strong>Chargeback</strong>.
          </p>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyUrl}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Como funciona</h2>
          </div>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Quando um cliente compra na Cakto, o webhook é disparado automaticamente</li>
            <li>O sistema localiza o tenant pelo <strong>email do cliente</strong></li>
            <li>Se o evento for <strong>compra aprovada</strong> ou <strong>renovação</strong>, o acesso é liberado</li>
            <li>Se for <strong>reembolso</strong>, <strong>chargeback</strong> ou <strong>cancelamento</strong>, o acesso é bloqueado</li>
          </ol>
        </div>

        {/* Important */}
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h2 className="text-sm font-semibold text-foreground">Importante</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            O <strong>email do cliente na Cakto</strong> precisa ser o mesmo email usado para cadastro no LeadFlow. 
            É assim que o sistema identifica qual tenant deve ser ativado ou desativado.
          </p>
        </div>

        {/* Events */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Eventos Suportados</h2>
          <div className="space-y-1.5">
            {[
              ['purchase_approved', 'Compra aprovada', '✅ Ativa acesso'],
              ['subscription_renewed', 'Assinatura renovada', '✅ Mantém acesso'],
              ['subscription_canceled', 'Assinatura cancelada', '🚫 Bloqueia acesso'],
              ['refund', 'Reembolso', '🚫 Bloqueia acesso'],
              ['chargeback', 'Chargeback', '🚫 Bloqueia acesso'],
            ].map(([event, label, action]) => (
              <div key={event} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <code className="text-[11px] font-mono text-foreground w-44">{event}</code>
                <span className="text-[11px] text-muted-foreground flex-1">{label}</span>
                <span className="text-[11px]">{action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Segurança (opcional)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure o secret <code className="px-1 py-0.5 bg-muted rounded text-[11px]">CAKTO_WEBHOOK_SECRET</code> no backend 
            e preencha o campo <strong>"Secret"</strong> ao criar o webhook na Cakto. O sistema validará automaticamente.
          </p>
        </div>

        {/* Payload Example */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Exemplo de Payload</h2>
          <p className="text-xs text-muted-foreground">
            Este é o formato que a Cakto envia ao webhook:
          </p>
          <pre className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto">
            {examplePayload}
          </pre>
        </div>
      </div>
    </AppLayout>
  );
}
