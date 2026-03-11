
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cakto_customer_email text,
  ADD COLUMN IF NOT EXISTS cakto_subscription_id text;
