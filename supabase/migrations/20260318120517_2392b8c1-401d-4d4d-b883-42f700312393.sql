
CREATE TABLE public.tenant_allowed_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, page_path)
);

ALTER TABLE public.tenant_allowed_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin global can manage all tenant_allowed_pages"
  ON public.tenant_allowed_pages FOR ALL
  TO authenticated
  USING (is_admin_global());

CREATE POLICY "Empresa can read own tenant_allowed_pages"
  ON public.tenant_allowed_pages FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());
