
-- whatsapp_instances table
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  instance_token text,
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all whatsapp_instances" ON public.whatsapp_instances FOR ALL TO authenticated USING (is_admin_global());
CREATE POLICY "Empresa can manage own whatsapp_instances" ON public.whatsapp_instances FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- whatsapp_campaigns table
CREATE TABLE public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  mensagem text,
  media_url text,
  media_type text,
  tipo text NOT NULL DEFAULT 'texto',
  status text NOT NULL DEFAULT 'draft',
  total_contatos integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all whatsapp_campaigns" ON public.whatsapp_campaigns FOR ALL TO authenticated USING (is_admin_global());
CREATE POLICY "Empresa can manage own whatsapp_campaigns" ON public.whatsapp_campaigns FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

-- whatsapp_campaign_contacts table
CREATE TABLE public.whatsapp_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  nome text,
  cnpj text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaign_contacts ENABLE ROW LEVEL SECURITY;

-- For contacts, RLS via campaign's tenant_id
CREATE POLICY "Admin global can manage all campaign_contacts" ON public.whatsapp_campaign_contacts FOR ALL TO authenticated USING (is_admin_global());
CREATE POLICY "Empresa can manage own campaign_contacts" ON public.whatsapp_campaign_contacts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.whatsapp_campaigns c WHERE c.id = campaign_id AND c.tenant_id = get_user_tenant_id())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.whatsapp_campaigns c WHERE c.id = campaign_id AND c.tenant_id = get_user_tenant_id())
);

-- Storage bucket for whatsapp media
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true);

CREATE POLICY "Authenticated users can upload whatsapp media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp-media');
CREATE POLICY "Anyone can view whatsapp media" ON storage.objects FOR SELECT USING (bucket_id = 'whatsapp-media');
CREATE POLICY "Users can delete own whatsapp media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'whatsapp-media' AND (auth.uid())::text = (storage.foldername(name))[1]);
