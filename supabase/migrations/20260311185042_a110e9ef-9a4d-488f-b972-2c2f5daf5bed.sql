
-- CRM Pipeline Stages (customizable per tenant)
CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  posicao integer NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all crm_pipeline_stages"
  ON public.crm_pipeline_stages FOR ALL TO authenticated
  USING (is_admin_global());

CREATE POLICY "Empresa can manage own crm_pipeline_stages"
  ON public.crm_pipeline_stages FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- CRM Deals (cards no kanban)
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_pipeline_stages(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  valor numeric DEFAULT 0,
  telefone text,
  contato_nome text,
  cnpj text,
  notas text,
  perdido boolean NOT NULL DEFAULT false,
  ganho boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all crm_deals"
  ON public.crm_deals FOR ALL TO authenticated
  USING (is_admin_global());

CREATE POLICY "Empresa can manage own crm_deals"
  ON public.crm_deals FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- CRM Deal Activities (log de atividades)
CREATE TABLE public.crm_deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nota',
  descricao text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all crm_deal_activities"
  ON public.crm_deal_activities FOR ALL TO authenticated
  USING (is_admin_global());

CREATE POLICY "Empresa can manage own crm_deal_activities"
  ON public.crm_deal_activities FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Enable realtime for CRM tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_deal_activities;
