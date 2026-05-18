-- Materiales de estudio: agregar adjuntos PDF/imagen y nueva categoría
-- "oracion_del_mes" para la imagen mensual que la Asamblea Local
-- comparte y los miembros reenvían por WhatsApp.
--
-- Run once in the Supabase SQL Editor.

-- ─── Columns ──────────────────────────────────────────────────────
alter table public.study_materials
  add column if not exists pdf_url text,
  add column if not exists image_url text;

-- Permitir la nueva categoría sin perder las existentes.
alter table public.study_materials
  drop constraint if exists study_materials_kind_check;
alter table public.study_materials
  add constraint study_materials_kind_check
  check (kind in ('ruhi', 'escritos', 'oraciones', 'oracion_del_mes'));

create index if not exists study_materials_kind_created_idx
  on public.study_materials (kind, created_at desc);

-- ─── Storage bucket ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', true)
on conflict (id) do nothing;

drop policy if exists "materiales_public_read" on storage.objects;
create policy "materiales_public_read" on storage.objects
  for select using (bucket_id = 'materiales');

drop policy if exists "materiales_admin_insert" on storage.objects;
create policy "materiales_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'materiales' and public.is_admin(auth.uid())
  );

drop policy if exists "materiales_admin_update" on storage.objects;
create policy "materiales_admin_update" on storage.objects
  for update using (
    bucket_id = 'materiales' and public.is_admin(auth.uid())
  );

drop policy if exists "materiales_admin_delete" on storage.objects;
create policy "materiales_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'materiales' and public.is_admin(auth.uid())
  );
