CREATE POLICY "Authenticated can update vehicle photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicle-photos')
WITH CHECK (bucket_id = 'vehicle-photos');