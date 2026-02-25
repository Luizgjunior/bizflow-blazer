
-- Create storage bucket for exports
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false);

-- RLS: Users can read their own tenant exports
CREATE POLICY "Users can read own tenant exports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exports'
  AND (
    public.is_admin_global()
    OR (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  )
);

-- RLS: Service role can insert exports (edge functions use service role)
CREATE POLICY "Service can insert exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports');

-- RLS: Service role can update exports
CREATE POLICY "Service can update exports"
ON storage.objects FOR UPDATE
USING (bucket_id = 'exports');
