
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Anyone can view media" ON storage.objects
  FOR SELECT USING (bucket_id = 'vibelink-media');
CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'vibelink-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own media" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'vibelink-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own media" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'vibelink-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );
