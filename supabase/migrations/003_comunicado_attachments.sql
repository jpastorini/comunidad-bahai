-- Communiqués from the Local Spiritual Assembly: add subject, PDF and
-- image attachments. Also create a public 'comunicados' Storage bucket
-- with admin-only write access.
--
-- Run once in the Supabase SQL Editor.

-- ─── Columns ──────────────────────────────────────────────────────
alter table public.messages
  add column if not exists subject text,
  add column if not exists pdf_url text,
  add column if not exists image_url text;

-- ─── Storage bucket ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('comunicados', 'comunicados', true)
on conflict (id) do nothing;

-- Public read (the bucket is public, but also be explicit so listing
-- works for unauthenticated browsers).
drop policy if exists "comunicados_public_read" on storage.objects;
create policy "comunicados_public_read" on storage.objects
  for select using (bucket_id = 'comunicados');

-- Only admins can upload, update or delete.
drop policy if exists "comunicados_admin_insert" on storage.objects;
create policy "comunicados_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'comunicados' and public.is_admin(auth.uid())
  );

drop policy if exists "comunicados_admin_update" on storage.objects;
create policy "comunicados_admin_update" on storage.objects
  for update using (
    bucket_id = 'comunicados' and public.is_admin(auth.uid())
  );

drop policy if exists "comunicados_admin_delete" on storage.objects;
create policy "comunicados_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'comunicados' and public.is_admin(auth.uid())
  );
