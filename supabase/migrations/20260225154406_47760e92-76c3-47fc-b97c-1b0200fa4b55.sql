
-- Table to store webhook tokens per tenant
CREATE TABLE public.webhook_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- One active token per tenant
CREATE UNIQUE INDEX idx_webhook_tokens_tenant_active ON public.webhook_tokens(tenant_id) WHERE ativo = true;

-- Enable RLS
ALTER TABLE public.webhook_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin global can manage all webhook_tokens"
  ON public.webhook_tokens FOR ALL
  USING (is_admin_global());

CREATE POLICY "Empresa can read own tokens"
  ON public.webhook_tokens FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Empresa can insert own tokens"
  ON public.webhook_tokens FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Empresa can update own tokens"
  ON public.webhook_tokens FOR UPDATE
  USING (tenant_id = get_user_tenant_id());
