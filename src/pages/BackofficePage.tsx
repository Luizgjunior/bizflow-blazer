import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  Building2, Users, Plus, Trash2, Loader2, Shield, BarChart3,
  Target, Play, FileText, Activity, Webhook, Copy, Check, Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BackofficePage() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Backoffice"
        description="Painel administrativo global"
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="tenants"><TenantsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="webhook"><WebhookTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function OverviewTab() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ['backoffice-counts'],
    queryFn: async () => {
      const [tenants, profiles, icps, runs, leads, exports] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('icps').select('*', { count: 'exact', head: true }),
        supabase.from('runs').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('exports').select('*', { count: 'exact', head: true }),
      ]);
      return {
        tenants: tenants.count ?? 0,
        users: profiles.count ?? 0,
        icps: icps.count ?? 0,
        runs: runs.count ?? 0,
        leads: leads.count ?? 0,
        exports: exports.count ?? 0,
      };
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
      <StatCard title="Tenants" value={counts?.tenants ?? 0} icon={Building2} variant="primary" />
      <StatCard title="Usuários" value={counts?.users ?? 0} icon={Users} />
      <StatCard title="ICPs" value={counts?.icps ?? 0} icon={Target} variant="accent" />
      <StatCard title="Runs" value={counts?.runs ?? 0} icon={Play} variant="warning" />
      <StatCard title="Leads" value={counts?.leads ?? 0} icon={Activity} variant="primary" />
      <StatCard title="Exports" value={counts?.exports ?? 0} icon={FileText} />
    </div>
  );
}

function TenantsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [plano, setPlano] = useState('starter');
  const [limites, setLimites] = useState('1000');

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['backoffice-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createTenant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenants').insert({
        nome,
        plano,
        limites_consulta: parseInt(limites),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['backoffice-counts'] });
      toast.success('Tenant criado!');
      setDialogOpen(false);
      setNome('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['backoffice-counts'] });
      toast.success('Tenant excluído');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Novo Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Tenant</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome</Label><Input className="mt-1.5" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da empresa" /></div>
              <div>
                <Label>Plano</Label>
                <Select value={plano} onValueChange={setPlano}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Limite de Consultas</Label><Input type="number" className="mt-1.5" value={limites} onChange={e => setLimites(e.target.value)} /></div>
              <Button className="w-full" onClick={() => createTenant.mutate()} disabled={!nome || createTenant.isPending}>
                {createTenant.isPending ? 'Criando...' : 'Criar Tenant'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhum tenant cadastrado.</p></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground p-3 pl-4">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Plano</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Limite</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Criado</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-3 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 pl-4 text-sm font-medium text-foreground">{t.nome}</td>
                  <td className="p-3"><Badge variant="secondary" className="text-[10px] capitalize">{t.plano}</Badge></td>
                  <td className="p-3 text-sm text-muted-foreground">{t.limites_consulta.toLocaleString()}</td>
                  <td className="p-3 text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 pr-4 text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteTenant.mutate(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['backoffice-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role), tenants(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground p-3 pl-4">Nome</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Tenant</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u: any) => {
                const roles = u.user_roles as any[];
                const roleLabel = roles?.length > 0 ? roles[0].role : 'sem role';
                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 pl-4 text-sm font-medium text-foreground">{u.nome}</td>
                    <td className="p-3 text-sm text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <Badge variant={roleLabel === 'admin_global' ? 'default' : 'secondary'} className="text-[10px]">
                        {roleLabel === 'admin_global' ? (
                          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</span>
                        ) : roleLabel}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{u.tenants?.nome || '—'}</td>
                    <td className="p-3 text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WebhookTab() {
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
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">URL do Webhook Universal</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Cole esta URL no painel do provedor de dados em <strong>Configurações → Webhook</strong>.
          Os leads serão distribuídos automaticamente para todos os tenants.
        </p>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="font-mono text-xs" />
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyUrl}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Como funciona</h2>
        </div>
        <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
          <li>O provedor de dados envia um POST com os CNPJs detectados</li>
          <li>O sistema deduplica automaticamente por CNPJ</li>
          <li>Os leads são inseridos para <strong>todos os tenants</strong> do sistema</li>
          <li>Os dados aparecem no Dashboard e na página de Leads de cada tenant</li>
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Formato do Payload</h2>
        <pre className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto">
          {examplePayload}
        </pre>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Mapeamento de Campos</h2>
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
  );
}
