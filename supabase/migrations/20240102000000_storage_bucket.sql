-- Storage Bucket for Meter Reading Photos
-- Creates a private Supabase Storage bucket and per-user RLS policies.
-- Folder convention: {user_id}/{filename}

-- ── Bucket ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meter-photos',
  'meter-photos',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- ── RLS Policies ─────────────────────────────────────────────────────
-- Authenticated users may only access objects inside their own sub-folder.

create policy "Users can upload meter photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own meter photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own meter photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own meter photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
