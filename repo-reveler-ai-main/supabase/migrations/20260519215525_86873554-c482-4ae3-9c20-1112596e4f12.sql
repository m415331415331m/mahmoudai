insert into storage.buckets (id, name, public) values ('published', 'published', true) on conflict (id) do nothing;

create policy "Public read published" on storage.objects for select using (bucket_id = 'published');

create policy "Users upload own published" on storage.objects for insert to authenticated with check (bucket_id = 'published' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own published" on storage.objects for update to authenticated using (bucket_id = 'published' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own published" on storage.objects for delete to authenticated using (bucket_id = 'published' and (storage.foldername(name))[1] = auth.uid()::text);