INSERT INTO storage.buckets (id, name, public) VALUES ('financing-docs', 'financing-docs', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload financing docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'financing-docs');
CREATE POLICY "Authenticated users can read financing docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'financing-docs');
CREATE POLICY "Authenticated users can delete financing docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'financing-docs');