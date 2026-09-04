-- Private buckets for receipt and pantry photos. Objects are stored under
-- "{user_id}/{filename}" — policies below check that path prefix against
-- auth.uid(), so a user can only ever read/write their own folder.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false), ('pantry', 'pantry', false);

create policy "receipts_bucket_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_bucket_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_bucket_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "pantry_bucket_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'pantry' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "pantry_bucket_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pantry' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "pantry_bucket_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pantry' and (storage.foldername(name))[1] = auth.uid()::text);
