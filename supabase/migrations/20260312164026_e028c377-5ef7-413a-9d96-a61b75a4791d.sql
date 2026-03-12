-- Email campaigns table (mirrors whatsapp_campaigns)
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  assunto text NOT NULL DEFAULT '',
  mensagem text,
  status text NOT NULL DEFAULT 'draft',
  total_contatos integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  use_ai_variations boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all email_campaigns"
  ON public.email_campaigns FOR ALL TO authenticated
  USING (is_admin_global());

CREATE POLICY "Empresa can manage own email_campaigns"
  ON public.email_campaigns FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Email campaign contacts table (mirrors whatsapp_campaign_contacts)
CREATE TABLE public.email_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all email_campaign_contacts"
  ON public.email_campaign_contacts FOR ALL TO authenticated
  USING (is_admin_global());

CREATE POLICY "Empresa can manage own email_campaign_contacts"
  ON public.email_campaign_contacts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM email_campaigns c
    WHERE c.id = email_campaign_contacts.campaign_id
    AND c.tenant_id = get_user_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_campaigns c
    WHERE c.id = email_campaign_contacts.campaign_id
    AND c.tenant_id = get_user_tenant_id()
  ));