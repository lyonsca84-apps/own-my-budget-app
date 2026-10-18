-- Optional profile details for Settings → Profile. Additive only; existing
-- rows keep their values and the new columns start empty (never invented).
--   age_range   — optional age band, used only to tailor educational content.
--   avatar_path — the user's own profile photo in the profile-images bucket.
--   logo_path   — an optional household or business logo, same bucket.
-- Each path must live in the owner's own folder ("{user_id}/..."), enforced
-- here and again by the storage policies below — never by the client alone.
alter table public.profiles
  add column if not exists age_range text
    check (age_range in ('under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus')),
  add column if not exists avatar_path text
    check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  add column if not exists logo_path text
    check (logo_path is null or split_part(logo_path, '/', 1) = id::text);

-- Private bucket: 5 MB per file, PNG/JPEG/WebP only. Objects live under
-- "{user_id}/{kind}-{timestamp}.{ext}" and are read through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "profile_images_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "profile_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "profile_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
