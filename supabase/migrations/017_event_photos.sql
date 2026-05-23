-- ═════════════════════════════════════════════════════════════════
-- Galería de fotos por evento (Fase 1)
--
-- Una sola tabla `event_photos` que cubre fotos de:
--   * Eventos del calendario   (event_type = 'calendar')
--   * Fiestas de los 19 Días   (event_type = 'feast')
--   * Días Sagrados            (event_type = 'calendar', viven en calendar_events)
--
-- Permisos (RLS):
--   - Cualquier miembro autenticado de la localidad sube fotos
--   - Solo miembros de la localidad ven la galería
--   - El autor puede borrar sus propias fotos
--   - La Asamblea puede borrar cualquier foto de su localidad
--
-- Hooks para Fase 2 (boletín nacional, sin UI todavía):
--   - visibility default 'locality', soporta 'national'
--   - featured boolean para marcar destacadas
-- ═════════════════════════════════════════════════════════════════

create table if not exists public.event_photos (
  id uuid primary key default uuid_generate_v4(),

  -- Referencia polimórfica: el FK real depende de event_type.
  event_type text not null check (event_type in ('calendar', 'feast')),
  event_id uuid not null,

  -- Quién la subió (denormalizamos el nombre para display).
  uploader_user_id uuid not null references auth.users(id) on delete set null,
  uploader_name text not null,

  -- Storage: paths viven en el bucket 'event-photos' con la estructura
  --   {locality_id}/{event_type}/{event_id}/{uuid}.{ext}
  storage_path text not null unique,
  public_url text not null,

  caption text,

  -- Multi-tenancy
  locality_id uuid not null references public.localities(id) on delete cascade,

  -- Hooks Fase 2
  visibility text not null default 'locality'
    check (visibility in ('locality', 'national')),
  featured boolean not null default false,

  -- Metadatos del archivo
  file_size_bytes int,
  mime_type text,

  created_at timestamptz not null default now()
);

create index if not exists event_photos_event_idx
  on public.event_photos (event_type, event_id);
create index if not exists event_photos_locality_created_idx
  on public.event_photos (locality_id, created_at desc);
create index if not exists event_photos_uploader_idx
  on public.event_photos (uploader_user_id, created_at desc);
create index if not exists event_photos_featured_idx
  on public.event_photos (locality_id, featured)
  where featured = true;

alter table public.event_photos enable row level security;

-- Trigger que auto-llena locality_id si no se provee
drop trigger if exists event_photos_set_locality on public.event_photos;
create trigger event_photos_set_locality
  before insert on public.event_photos
  for each row execute function public.set_locality_from_auth();

-- Select: miembros de la localidad
drop policy if exists "event_photos_select_locality" on public.event_photos;
create policy "event_photos_select_locality" on public.event_photos
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

-- Insert: miembros autenticados, como ellos mismos, en su localidad
drop policy if exists "event_photos_insert_self" on public.event_photos;
create policy "event_photos_insert_self" on public.event_photos
  for insert with check (
    uploader_user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );

-- Update: solo la propia foto (caption editable). Para Fase 2, los admins
-- podrán cambiar visibility/featured; pero por ahora restringimos al autor.
drop policy if exists "event_photos_update_self" on public.event_photos;
create policy "event_photos_update_self" on public.event_photos
  for update using (uploader_user_id = auth.uid())
  with check (uploader_user_id = auth.uid());

drop policy if exists "event_photos_update_admin" on public.event_photos;
create policy "event_photos_update_admin" on public.event_photos
  for update
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

-- Delete: el propio uploader o un admin de la localidad
drop policy if exists "event_photos_delete_self" on public.event_photos;
create policy "event_photos_delete_self" on public.event_photos
  for delete using (uploader_user_id = auth.uid());

drop policy if exists "event_photos_delete_admin" on public.event_photos;
create policy "event_photos_delete_admin" on public.event_photos
  for delete using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Supabase Storage: bucket público ────────────────────────────
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

-- Storage policies. Las uploads y deletes pasan por server actions
-- que validan localidad y rol, pero igual aseguramos las policies
-- básicas en el bucket.

drop policy if exists "event_photos_storage_read" on storage.objects;
create policy "event_photos_storage_read" on storage.objects
  for select using (bucket_id = 'event-photos');

drop policy if exists "event_photos_storage_insert" on storage.objects;
create policy "event_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'event-photos'
    and auth.uid() is not null
  );

-- Delete autorizado si el path apunta a una foto en event_photos que
-- el usuario puede borrar (autor o admin de su localidad).
drop policy if exists "event_photos_storage_delete" on storage.objects;
create policy "event_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'event-photos'
    and (
      exists (
        select 1 from public.event_photos ep
        where ep.storage_path = name
        and (
          ep.uploader_user_id = auth.uid()
          or (
            public.is_admin(auth.uid())
            and ep.locality_id = public.current_locality_id()
          )
        )
      )
    )
  );
