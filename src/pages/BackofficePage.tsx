import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  Building2, Users, Plus, Trash2, Loader2, Shield, BarChart3,
  Target, Play, FileText, Activity, Webhook, Copy, Check, Info,
  Edit, TrendingUp, AlertTriangle, Save, CreditCard, DollarSign,
  TrendingDown, CalendarDays, Receipt, Mail, MessageCircle, Bot,
  Eye, ChevronRight,
} from 'lucide-react';
import { LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AppLayout from '@/components/AppLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
      <PageHeader title="Backoffice" description="Painel administrativo global" />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
          <TabsTrigger value="tenants" className="text-xs">Tenants</TabsTrigger>
          <TabsTrigger value="consumo" className="text-xs">Consumo</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Usuários</TabsTrigger>
          <TabsTrigger value="suporte" className="text-xs">Suporte</TabsTrigger>
          <TabsTrigger value="webhook" className="text-xs">Webhook</TabsTrigger>
          <TabsTrigger value="assinaturas" className="text-xs">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="tenants"><TenantsTab /></TabsContent>
        <TabsContent value="consumo"><ConsumoTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="suporte"><SuporteTab /></TabsContent>
        <TabsContent value="webhook"><WebhookTab /></TabsContent>
        <TabsContent value="assinaturas"><AssinaturasTab /></TabsContent>
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

  // Leads por dia (últimos 7 dias)
  const { data: dailyLeads = [] } = useQuery({
    queryKey: ['backoffice-daily-leads'],
    queryFn: async () => {
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());

        result.push({
          dia: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          leads: count ?? 0,
        });
      }
      return result;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Tenants" value={counts?.tenants ?? 0} icon={Building2} variant="primary" />
        <StatCard title="Usuários" value={counts?.users ?? 0} icon={Users} />
        <StatCard title="ICPs" value={counts?.icps ?? 0} icon={Target} variant="accent" />
        <StatCard title="Runs" value={counts?.runs ?? 0} icon={Play} variant="warning" />
        <StatCard title="Leads" value={counts?.leads ?? 0} icon={Activity} variant="primary" />
        <StatCard title="Exports" value={counts?.exports ?? 0} icon={FileText} />
      </div>

      {dailyLeads.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Leads por Dia (Global)</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyLeads}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsumoTab() {
  const { data: tenantsConsumo = [], isLoading } = useQuery({
    queryKey: ['backoffice-consumo'],
    queryFn: async () => {
      const { data: tenants } = await supabase.from('tenants').select('*').order('nome');
      if (!tenants) return [];

      const results = [];
      for (const tenant of tenants) {
        const [leads, runs, exports] = await Promise.all([
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).not('run_id', 'is', null),
          supabase.from('runs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
          supabase.from('exports').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        ]);

        results.push({
          ...tenant,
          leads_count: leads.count ?? 0,
          runs_count: runs.count ?? 0,
          exports_count: exports.count ?? 0,
          usage_percent: Math.min(100, ((leads.count ?? 0) / tenant.limites_consulta) * 100),
        });
      }
      return results;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Consumo por Tenant</h2>
      {tenantsConsumo.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum tenant.</p>
      ) : (
        <div className="space-y-3">
          {tenantsConsumo.map((t: any) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t.nome}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Plano <span className="capitalize">{t.plano}</span> • Limite: {t.limites_consulta.toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant={t.usage_percent > 90 ? 'destructive' : t.usage_percent > 70 ? 'outline' : 'secondary'}
                  className="text-[10px]"
                >
                  {Math.round(t.usage_percent)}%
                </Badge>
              </div>
              <Progress value={t.usage_percent} className="h-2 mb-3" />
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{t.leads_count.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Leads</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{t.runs_count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Runs</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">{t.exports_count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Exports</p>
                </div>
              </div>
              {t.usage_percent > 90 && (
                <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  <p className="text-[11px] text-destructive font-medium">Limite quase esgotado</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [nome, setNome] = useState('');
  const [plano, setPlano] = useState('pro');
  const [limites, setLimites] = useState('1000');

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['backoffice-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setNome(''); setPlano('pro'); setLimites('1000'); setEditingTenant(null);
  };

  const openEdit = (tenant: any) => {
    setEditingTenant(tenant);
    setNome(tenant.nome);
    setPlano(tenant.plano);
    setLimites(tenant.limites_consulta.toString());
    setDialogOpen(true);
  };

  const saveTenant = useMutation({
    mutationFn: async () => {
      if (editingTenant) {
        const { error } = await supabase.from('tenants').update({
          nome, plano, limites_consulta: parseInt(limites),
        }).eq('id', editingTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenants').insert({
          nome, plano, limites_consulta: parseInt(limites),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['backoffice-counts'] });
      queryClient.invalidateQueries({ queryKey: ['backoffice-consumo'] });
      toast.success(editingTenant ? 'Tenant atualizado!' : 'Tenant criado!');
      setDialogOpen(false);
      resetForm();
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
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Novo Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTenant ? 'Editar Tenant' : 'Criar Tenant'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome</Label><Input className="mt-1.5" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da empresa" /></div>
              <div>
                <Label>Plano</Label>
                 <Select value={plano} onValueChange={setPlano}>
                   <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="pro">Pro</SelectItem>
                     <SelectItem value="premium">Premium</SelectItem>
                     <SelectItem value="enterprise">Enterprise</SelectItem>
                   </SelectContent>
                 </Select>
              </div>
              <div><Label>Limite de Consultas</Label><Input type="number" className="mt-1.5" value={limites} onChange={e => setLimites(e.target.value)} /></div>
              <Button className="w-full gap-1.5" onClick={() => saveTenant.mutate()} disabled={!nome || saveTenant.isPending}>
                {saveTenant.isPending ? 'Salvando...' : editingTenant ? <><Save className="w-4 h-4" /> Salvar</> : 'Criar Tenant'}
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
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
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
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(t)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteTenant.mutate(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {tenants.map((t: any) => (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{t.plano}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Limite: {t.limites_consulta.toLocaleString()} consultas</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => openEdit(t)}>
                    <Edit className="w-3.5 h-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => deleteTenant.mutate(t.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTenantId, setFormTenantId] = useState('');
  const [formRole, setFormRole] = useState('empresa');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['backoffice-users'],
    queryFn: async () => {
      const [profilesRes, rolesRes, tenantsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('*'),
        supabase.from('tenants').select('id, nome'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      const roles = rolesRes.data ?? [];
      const tenants = tenantsRes.data ?? [];
      return (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        user_roles: roles.filter((r: any) => r.user_id === p.id),
        tenants: tenants.find((t: any) => t.id === p.tenant_id) || null,
      }));
    },
  });

  const { data: tenantsList = [] } = useQuery({
    queryKey: ['backoffice-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, nome').order('nome');
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setFormNome(''); setFormEmail(''); setFormPassword(''); setFormTenantId(''); setFormRole('empresa'); setEditingUser(null);
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setFormNome(user.nome);
    setFormEmail(user.email);
    setFormTenantId(user.tenant_id || '');
    const roles = user.user_roles as any[];
    setFormRole(roles?.length > 0 ? roles[0].role : 'empresa');
    setDialogOpen(true);
  };

  const saveUser = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'update', user_id: editingUser.id, nome: formNome, tenant_id: formTenantId || null, role: formRole },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'create', email: formEmail, password: formPassword || undefined, nome: formNome, tenant_id: formTenantId || null, role: formRole },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-users'] });
      queryClient.invalidateQueries({ queryKey: ['backoffice-counts'] });
      toast.success(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-users'] });
      queryClient.invalidateQueries({ queryKey: ['backoffice-counts'] });
      toast.success('Usuário excluído');
    },
    onError: (e: any) => toast.error(e.message),
  });


  const UserActions = ({ user }: { user: any }) => (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(user)}>
        <Edit className="w-3.5 h-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (confirm('Excluir este usuário?')) deleteUser.mutate(user.id); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingUser ? 'Editar Usuário' : 'Criar Usuário'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome</Label><Input className="mt-1.5" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome do usuário" /></div>
              {!editingUser && (
                <div><Label>Email</Label><Input type="email" className="mt-1.5" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
              )}
              {!editingUser && (
                <div><Label>Senha</Label><Input type="password" className="mt-1.5" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} /></div>
              )}
              <div>
                <Label>Tenant</Label>
                <Select value={formTenantId} onValueChange={setFormTenantId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione um tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenantsList.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="admin_global">Admin Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gap-1.5" onClick={() => saveUser.mutate()} disabled={(!editingUser && !formEmail) || saveUser.isPending}>
                {saveUser.isPending ? 'Salvando...' : editingUser ? <><Save className="w-4 h-4" /> Salvar</> : 'Criar Usuário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12"><p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 pl-4">Nome</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Role</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Tenant</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Criado</th>
                  <th className="text-right text-xs font-medium text-muted-foreground p-3 pr-4">Ações</th>
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
                      <td className="p-3 pr-4 text-right"><UserActions user={u} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {users.map((u: any) => {
              const roles = u.user_roles as any[];
              const roleLabel = roles?.length > 0 ? roles[0].role : 'sem role';
              return (
                <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">{u.nome}</p>
                    <Badge variant={roleLabel === 'admin_global' ? 'default' : 'secondary'} className="text-[10px]">
                      {roleLabel === 'admin_global' ? 'Admin' : roleLabel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Tenant: {u.tenants?.nome || '—'}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => openEdit(u)}>
                      <Edit className="w-3 h-3" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => { if (confirm('Excluir?')) deleteUser.mutate(u.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
          <li>O score é calculado automaticamente com base nos ICPs do tenant</li>
          <li>O limite de consultas por tenant é respeitado</li>
          <li>Os leads aparecem no Dashboard e na página de Leads</li>
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

function AssinaturasTab() {
  const PLAN_PRICES: Record<string, number> = {
    pro: 97,
    premium: 197,
    enterprise: 297,
  };

  const PLAN_COLORS_ARRAY = ['hsl(var(--primary))', 'hsl(210, 100%, 60%)', 'hsl(280, 70%, 60%)'];

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['backoffice-financial-tenants'],
    queryFn: async () => {
      const [tenantsRes, rolesRes, profilesRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('profiles').select('id, nome, email, tenant_id'),
      ]);
      if (tenantsRes.error) throw tenantsRes.error;

      // Find tenant_ids belonging to admin_global users
      const adminUserIds = (rolesRes.data ?? []).filter((r: any) => r.role === 'admin_global').map((r: any) => r.user_id);
      const adminTenantIds = new Set(
        (profilesRes.data ?? []).filter((p: any) => adminUserIds.includes(p.id) && p.tenant_id).map((p: any) => p.tenant_id)
      );

      // Exclude admin tenants from financial reports
      return (tenantsRes.data ?? []).filter((t: any) => !adminTenantIds.has(t.id));
    },
  });

  // Fetch profiles to show user info per tenant
  const { data: profiles = [] } = useQuery({
    queryKey: ['backoffice-financial-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email, tenant_id');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  const activeTenants = tenants.filter((t: any) => t.ativo);
  const inactiveTenants = tenants.filter((t: any) => !t.ativo);

  // Calculate MRR from active tenants
  const mrr = activeTenants.reduce((sum: number, t: any) => sum + (PLAN_PRICES[t.plano] || 0), 0);
  const arr = mrr * 12;

  // Plan breakdown
  const planBreakdown = Object.entries(PLAN_PRICES).map(([plan, price]) => {
    const count = activeTenants.filter((t: any) => t.plano === plan).length;
    return { plan, count, revenue: count * price };
  });

  // Monthly history based on tenant created_at (last 6 months)
  const monthlyRevenue: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenue[key] = 0;
  }

  // For each month, count active tenants that existed by that month
  for (const key of Object.keys(monthlyRevenue)) {
    const [year, month] = key.split('-').map(Number);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const activeByMonth = tenants.filter((t: any) => {
      const created = new Date(t.created_at);
      return created <= monthEnd && t.ativo;
    });
    monthlyRevenue[key] = activeByMonth.reduce((sum: number, t: any) => sum + (PLAN_PRICES[t.plano] || 0), 0);
  }

  const monthlyData = Object.entries(monthlyRevenue).map(([month, amount]) => ({ month, amount }));

  const ticketMedio = activeTenants.length > 0 ? (mrr / activeTenants.length) : 0;

  const getProfileForTenant = (tenantId: string) => profiles.find((p: any) => p.tenant_id === tenantId);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          title="MRR"
          value={`R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="ARR Projetado"
          value={`R$ ${arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Clientes Ativos"
          value={activeTenants.length}
          icon={Users}
          variant="accent"
        />
        <StatCard
          title="Ticket Médio"
          value={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={CalendarDays}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Monthly Revenue */}
        {monthlyData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Receita Mensal</h2>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: string) => {
                      const [y, m] = v.split('-');
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']}
                  />
                  <Bar dataKey="amount" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Plan Breakdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Distribuição por Plano</h2>
          </div>
          <div className="h-48 flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie
                  data={planBreakdown.filter((p) => p.count > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  dataKey="count"
                  nameKey="plan"
                >
                  {planBreakdown.map((_, i) => (
                    <Cell key={i} fill={PLAN_COLORS_ARRAY[i % PLAN_COLORS_ARRAY.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {planBreakdown.map((p, i) => (
                <div key={p.plan} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS_ARRAY[i] }} />
                    <span className="text-xs font-medium text-foreground capitalize">{p.plan}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{p.count} cliente{p.count !== 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-muted-foreground">R$ {p.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Extra metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Receipt className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">{inactiveTenants.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Inativos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Building2 className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">{tenants.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Total Tenants</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <DollarSign className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">
            R$ {arr.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Projeção Anual</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <TrendingUp className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">
            {tenants.length > 0 ? ((activeTenants.length / tenants.length) * 100).toFixed(0) : 0}%
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Taxa de Ativação</p>
        </div>
      </div>

      {/* Clients table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Clientes</h2>
        </div>

        {tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente cadastrado.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground p-3 pl-4">Empresa</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Responsável</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Plano</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Valor</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenants.map((t: any) => {
                    const profile = getProfileForTenant(t.id);
                    return (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 pl-4 text-sm font-medium text-foreground">{t.nome}</td>
                        <td className="p-3 text-sm text-muted-foreground">{profile?.email || '—'}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-[10px] capitalize">{t.plano}</Badge>
                        </td>
                        <td className="p-3 text-sm font-medium text-foreground">
                          R$ {(PLAN_PRICES[t.plano] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <Badge variant={t.ativo ? 'default' : 'destructive'} className="text-[10px]">
                            {t.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {tenants.map((t: any) => {
                const profile = getProfileForTenant(t.id);
                return (
                  <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground">{t.nome}</p>
                      <Badge variant={t.ativo ? 'default' : 'destructive'} className="text-[10px]">
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{profile?.email || '—'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className="text-[10px] capitalize">{t.plano}</Badge>
                      <p className="text-sm font-bold text-foreground">
                        R$ {(PLAN_PRICES[t.plano] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Desde {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────── Suporte Tab ───────────── */

function SuporteTab() {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['backoffice-support-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['backoffice-support-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email, tenant_id');
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ['backoffice-support-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('id, nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ['backoffice-support-messages', selectedConv],
    queryFn: async () => {
      if (!selectedConv) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', selectedConv)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedConv,
  });

  const getProfile = (userId: string) => profiles?.find(p => p.id === userId);
  const getTenant = (tenantId: string | null) => tenants?.find(t => t.id === tenantId);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Conversations List */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-primary" />
          Conversas ({conversations?.length ?? 0})
        </h3>

        {(!conversations || conversations.length === 0) && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma conversa de suporte ainda</p>
          </div>
        )}

        {conversations?.map((conv) => {
          const profile = getProfile(conv.user_id);
          const tenant = getTenant(conv.tenant_id);
          const isSelected = selectedConv === conv.id;
          return (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {profile?.nome || profile?.email || 'Usuário'}
                </p>
                <Badge variant={conv.status === 'open' ? 'default' : 'secondary'} className="text-[9px] h-4">
                  {conv.status === 'open' ? 'Aberta' : 'Fechada'}
                </Badge>
              </div>
              {tenant && (
                <p className="text-[10px] text-muted-foreground mb-1">{tenant.nome}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {new Date(conv.updated_at).toLocaleString('pt-BR')}
              </p>
            </button>
          );
        })}
      </div>

      {/* Messages Panel */}
      <div className="lg:col-span-2">
        {!selectedConv ? (
          <div className="text-center py-16 border border-border rounded-xl bg-card">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Selecione uma conversa para visualizar</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold text-foreground">
                Conversa com {getProfile(conversations?.find(c => c.id === selectedConv)?.user_id ?? '')?.nome || 'Usuário'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {getProfile(conversations?.find(c => c.id === selectedConv)?.user_id ?? '')?.email}
              </p>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
              {messages?.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {(!messages || messages.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Sem mensagens</p>
              )}
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground">
                {messages?.length ?? 0} mensagens • Iniciada em{' '}
                {conversations?.find(c => c.id === selectedConv)?.created_at
                  ? new Date(conversations.find(c => c.id === selectedConv)!.created_at).toLocaleString('pt-BR')
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}