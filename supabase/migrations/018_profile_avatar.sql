-- ═════════════════════════════════════════════════════════════════
-- Perfiles: avatar y soporte para edición desde la app.
--
-- - Agrega columna avatar_url a profiles.
-- - Backfill desde auth.users.raw_user_meta_data para usuarios existentes
--   que ya entraron con Google (su avatar viene en 'avatar_url' o 'picture').
-- - Actualiza el trigger handle_new_user para que los nuevos usuarios
--   reciban su avatar de Google automáticamente.
-- - Crea bucket de Storage 'avatars' para fotos subidas a mano por el
--   usuario, con policies que solo permiten al dueño escribir su carpeta.
-- ═════════════════════════════════════════════════════════════════

-- 1. Columna avatar_url
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Backfill: traer avatar_url o picture de auth.users.raw_user_meta_data
update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture'
)
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and (
    u.raw_user_meta_data->>'avatar_url' is not null
    or u.raw_user_meta_data->>'picture' is not null
  );

-- 3. Trigger actualizado: nuevos usuarios reciben full_name y avatar_url
--    desde la metadata del provider (Google sobre todo).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Storage bucket para avatares subidos manualmente
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies del bucket 'avatars'.
-- Paths esperados: {user_id}/{uuid}.{ext}

drop policy if exists "avatars_storage_read" on storage.objects;
create policy "avatars_storage_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Insert / update / delete: solo si el primer segmento del path es el uid.
drop policy if exists "avatars_storage_insert_self" on storage.objects;
create policy "avatars_storage_insert_self" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_storage_update_self" on storage.objects;
create policy "avatars_storage_update_self" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_storage_delete_self" on storage.objects;
create policy "avatars_storage_delete_self" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
