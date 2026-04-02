ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS employer text,
  ADD COLUMN IF NOT EXISTS employment_time text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS salary numeric,
  ADD COLUMN IF NOT EXISTS birth_city text,
  ADD COLUMN IF NOT EXISTS reference_name text,
  ADD COLUMN IF NOT EXISTS reference_phone text,
  ADD COLUMN IF NOT EXISTS has_clean_credit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_down_payment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS down_payment_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'financing',
  ADD COLUMN IF NOT EXISTS financing_docs jsonb DEFAULT '{"cnh": false, "proof_of_residence": false, "pay_stub": false, "reference": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS financing_status text DEFAULT 'incomplete';

INSERT INTO storage.buckets (id, name, public) VALUES ('financing-docs', 'financing-docs', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated users can upload financing docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'financing-docs');
CREATE POLICY "Authenticated users can view financing docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'financing-docs');
CREATE POLICY "Authenticated users can delete financing docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'financing-docs');