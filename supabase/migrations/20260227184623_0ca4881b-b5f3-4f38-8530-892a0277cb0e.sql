
-- Add ativo column to tenants for access control
ALTER TABLE public.tenants ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Add cakto_customer_email to track which Cakto customer maps to this tenant
ALTER TABLE public.tenants ADD COLUMN cakto_customer_email text;

-- Add cakto_subscription_id to track the subscription
ALTER TABLE public.tenants ADD COLUMN cakto_subscription_id text;
