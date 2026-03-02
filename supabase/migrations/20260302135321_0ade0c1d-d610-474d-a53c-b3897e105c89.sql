
-- Add Stripe columns to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_status text DEFAULT 'inactive';

-- Remove Cakto columns
ALTER TABLE public.tenants 
  DROP COLUMN IF EXISTS cakto_customer_email,
  DROP COLUMN IF EXISTS cakto_subscription_id;

-- Update default plano value
ALTER TABLE public.tenants ALTER COLUMN plano SET DEFAULT 'pro';
