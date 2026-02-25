import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Webhook, Copy, Check, Shield, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WebhookPage() {
  const { tenantId } = useAuth();
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
    tenant_id: tenantId || "SEU_TENANT_ID",
    cnpj: "12345678000190",
    razao_social: "Empresa Exemplo LTDA",
    uf: "SP",
    municipio: "São Paulo",
    cnae_principal: "6201500",
    situacao: "ATIVA",
    data_abertura: "2020-01-15",
    tags: ["webhook", "parceiro"]
  }, null, 2);

  const batchPayload = JSON.stringify([
    {
      tenant_id: tenantId || "SEU_TENANT_ID",
      cnpj: "12345678000190",
      razao_social: "Empresa 1 LTDA",
      uf: "SP"
    },
    {
      tenant_id: tenantId || "SEU_TENANT_ID",
      cnpj: "98765432000199",
      razao_social: "Empresa 2 LTDA",
      uf: "RJ"
    }
  ], null, 2);

  return (
    <AppLayout>
      <PageHeader
        title="Webhook"
        description="Receba leads automaticamente via integração externa"
      />

      <div className="space-y-6 max-w-2xl">
        {/* Webhook URL */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Endpoint do Webhook</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie um POST para esta URL com os dados dos leads. Eles serão automaticamente deduplicados e inseridos.
          </p>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyUrl}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Segurança</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Para proteger o endpoint, envie o header <code className="px-1 py-0.5 bg-muted rounded text-[11px]">x-webhook-secret</code> com o valor configurado no backend.
          </p>
          <div className="rounded-lg bg-muted/50 p-3">
            <code className="text-xs text-muted-foreground">
              {`curl -X POST ${webhookUrl} \\`}<br />
              {`  -H "Content-Type: application/json" \\`}<br />
              {`  -H "x-webhook-secret: SEU_SECRET" \\`}<br />
              {`  -d '${JSON.stringify({ tenant_id: "...", cnpj: "...", razao_social: "..." })}'`}
            </code>
          </div>
        </div>

        {/* Single Payload */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Payload Único</h2>
          <pre className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto">
            {examplePayload}
          </pre>
        </div>

        {/* Batch Payload */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Payload em Lote</h2>
          <p className="text-xs text-muted-foreground">Envie um array para inserir múltiplos leads de uma vez.</p>
          <pre className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto">
            {batchPayload}
          </pre>
        </div>

        {/* Fields Reference */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Campos Aceitos</h2>
          <div className="space-y-1.5">
            {[
              ['tenant_id', 'obrigatório', 'UUID do tenant'],
              ['cnpj', 'obrigatório', 'CNPJ (com ou sem máscara)'],
              ['razao_social', 'opcional', 'Nome da empresa'],
              ['uf', 'opcional', 'Estado (ex: SP)'],
              ['municipio', 'opcional', 'Cidade'],
              ['cnae_principal', 'opcional', 'CNAE principal'],
              ['situacao', 'opcional', 'Situação cadastral'],
              ['data_abertura', 'opcional', 'Data de abertura (YYYY-MM-DD)'],
              ['score', 'opcional', 'Score manual (0-100)'],
              ['tags', 'opcional', 'Array de tags'],
              ['raw_json', 'opcional', 'Dados extras em JSON'],
            ].map(([field, req, desc]) => (
              <div key={field} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <code className="text-[11px] font-mono text-foreground w-28">{field}</code>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${req === 'obrigatório' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{req}</span>
                <span className="text-[11px] text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
