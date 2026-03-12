import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface PipelineStage {
  id: string;
  tenant_id: string;
  nome: string;
  posicao: number;
  cor: string;
  created_at: string;
}

export interface CrmDeal {
  id: string;
  tenant_id: string;
  stage_id: string;
  lead_id: string | null;
  titulo: string;
  valor: number;
  telefone: string | null;
  contato_nome: string | null;
  cnpj: string | null;
  notas: string | null;
  perdido: boolean;
  ganho: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  tenant_id: string;
  tipo: string;
  descricao: string;
  metadata: any;
  created_at: string;
}

const DEFAULT_STAGES = [
  { nome: 'Novo', posicao: 0, cor: '#3b82f6' },
  { nome: 'Contato', posicao: 1, cor: '#8b5cf6' },
  { nome: 'Proposta', posicao: 2, cor: '#f59e0b' },
  { nome: 'Negociação', posicao: 3, cor: '#f97316' },
  { nome: 'Fechado', posicao: 4, cor: '#22c55e' },
];

export function usePipelineStages() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['crm-stages', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('crm_pipeline_stages')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('posicao');
      if (error) throw error;
      return data as PipelineStage[];
    },
    enabled: !!tenantId,
  });

  // Auto-create default stages if none exist
  useEffect(() => {
    if (query.data && query.data.length === 0 && tenantId) {
      const createDefaults = async () => {
        const inserts = DEFAULT_STAGES.map(s => ({ ...s, tenant_id: tenantId }));
        await supabase.from('crm_pipeline_stages').insert(inserts);
        queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      };
      createDefaults();
    }
  }, [query.data, tenantId, queryClient]);

  return query;
}

export function useCrmDeals() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ['crm-deals', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CrmDeal[];
    },
    enabled: !!tenantId,
  });
}

export function useDealActivities(dealId?: string) {
  return useQuery({
    queryKey: ['crm-activities', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deal_activities')
        .select('*')
        .eq('deal_id', dealId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DealActivity[];
    },
    enabled: !!dealId,
  });
}

export function useRecentActivities() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ['crm-recent-activities', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deal_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as DealActivity[];
    },
    enabled: !!tenantId,
  });
}

export function useMoveDeal() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({ dealId, stageId, stageName }: { dealId: string; stageId: string; stageName?: string }) => {
      const { error } = await supabase
        .from('crm_deals')
        .update({ stage_id: stageId, updated_at: new Date().toISOString() })
        .eq('id', dealId);
      if (error) throw error;

      if (tenantId && stageName) {
        await supabase.from('crm_deal_activities').insert({
          deal_id: dealId,
          tenant_id: tenantId,
          tipo: 'movimentacao',
          descricao: `Movido para ${stageName}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-recent-activities'] });
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (deal: Partial<CrmDeal> & { titulo: string; stage_id: string }) => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('crm_deals')
        .insert({ ...deal, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('crm_deal_activities').insert({
        deal_id: data.id,
        tenant_id: tenantId,
        tipo: 'criacao',
        descricao: 'Deal criado',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm-recent-activities'] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CrmDeal> & { id: string }) => {
      const { error } = await supabase
        .from('crm_deals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase.from('crm_deals').delete().eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
  });
}

export function useManageStages() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  const addStage = useMutation({
    mutationFn: async ({ nome, cor, posicao }: { nome: string; cor: string; posicao: number }) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase
        .from('crm_pipeline_stages')
        .insert({ nome, cor, posicao, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-stages'] }),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PipelineStage> & { id: string }) => {
      const { error } = await supabase
        .from('crm_pipeline_stages')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-stages'] }),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_pipeline_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-stages'] }),
  });

  return { addStage, updateStage, deleteStage };
}

export function useCrmRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('crm-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_deals' }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_deal_activities' }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-recent-activities'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}
