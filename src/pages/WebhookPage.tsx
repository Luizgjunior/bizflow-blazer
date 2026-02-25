import { useState } from 'react';
import { Webhook, Copy, Check, Shield, Info } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function WebhookPage() {
  const [copied, setCopied] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/webhook-cnpj`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const examplePayload = JSON.stringify({
    data_evento: "2025-06-13T11:15:42.000Z",
    evento: [
      {
        cnpj: "33000167000101",
        razao_social: "EMPRESA EXEMPLO S/A",
        nome_fantasia: "EXEMPLO",
        uf: "SP",
        municipio: "SAO PAULO",
        cnae_fiscal: 6201500,
        situacao_cadastral: "ATIVA",
        data_inicio_atividade: "2020-01-15"
      }
    ]
  }, null, 2);

  return (
    <AppLayout>
      <PageHeader
        title="Webhook"
        description="Receba leads automaticamente da Casa dos Dados"
      />

      <div className="space-y-6 max-w-2xl">
        {/* Webhook URL */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">URL do Webhook</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole esta URL no painel da Casa dos Dados em <strong>Portal → API → Webhook</strong>. 
            Os leads serão distribuídos automaticamente para todos os usuários do sistema.
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
            <li>A Casa dos Dados envia um POST com os CNPJs detectados</li>
            <li>O sistema recebe e deduplica automaticamente por CNPJ</li>
            <li>Os leads são inseridos para <strong>todos os usuários</strong> do sistema</li>
            <li>Os dados aparecem no Dashboard e na página de Leads</li>
          </ol>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Segurança (opcional)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Se desejar proteger o endpoint, configure o secret <code className="px-1 py-0.5 bg-muted rounded text-[11px]">WEBHOOK_SECRET</code> no backend 
            e envie o header <code className="px-1 py-0.5 bg-muted rounded text-[11px]">x-webhook-secret</code> nas requisições.
          </p>
        </div>

        {/* Payload Example */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Formato do Payload (Casa dos Dados)</h2>
          <p className="text-xs text-muted-foreground">
            Este é o formato que a Casa dos Dados envia automaticamente:
          </p>
          <pre className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto">
            {examplePayload}
          </pre>
        </div>

        {/* Fields Reference */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Mapeamento de Campos</h2>
          <p className="text-xs text-muted-foreground">Campos recebidos da Casa dos Dados e como são armazenados:</p>
          <div className="space-y-1.5">
            {[
              ['cnpj', 'cnpj'],
              ['razao_social', 'razao_social'],
              ['uf', 'uf'],
              ['municipio', 'municipio'],
              ['cnae_fiscal', 'cnae_principal'],
              ['situacao_cadastral', 'situacao'],
              ['data_inicio_atividade', 'data_abertura'],
              ['(objeto completo)', 'raw_json'],
            ].map(([from, to]) => (
              <div key={from} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <code className="text-[11px] font-mono text-foreground w-40">{from}</code>
                <span className="text-[11px] text-muted-foreground">→</span>
                <code className="text-[11px] font-mono text-primary">{to}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
