-- Reset stuck campaign to draft and reset failed contacts to pending
UPDATE public.whatsapp_campaigns SET status = 'draft', enviados = 0, falhas = 0, started_at = NULL, finished_at = NULL WHERE id = 'a7835f83-c774-403c-a344-be710a5e26e4';
UPDATE public.whatsapp_campaign_contacts SET status = 'pending', error_message = NULL WHERE campaign_id = 'a7835f83-c774-403c-a344-be710a5e26e4' AND status = 'failed';
