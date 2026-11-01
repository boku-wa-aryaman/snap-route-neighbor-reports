create policy "users upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public read report photos" on storage.objects for select to anon, authenticated using (bucket_id = 'report-photos');