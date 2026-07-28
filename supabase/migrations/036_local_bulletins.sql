-- ═════════════════════════════════════════════════════════════════
-- Boletín local (por localidad).
--
-- La Asamblea Local (o usuarios designados con el tag
-- `can_manage_bulletin`) publica "ediciones" que compilan contenido que
-- ya vive en la base — próximos eventos, comunicados recientes y fotos —
-- más un texto editorial. El contenido se congela como snapshot JSON al
-- guardar, así la edición publicada no cambia si después se edita el
-- calendario o se borra una foto.
--
-- Ciclo: draft → published (reversible). Al publicar se avisa por push
-- a los miembros de la localidad.
--
-- `share_token` habilita un link público (/b/<token>) para compartir la
-- edición fuera de la app (WhatsApp, email). El token es largo y no
-- adivinable; la página pública se resuelve server-side con la
-- service-role key, por eso acá NO hay policy para `anon`.
-- ═════════════════════════════════════════════════════════════════

-- Tag de permiso: designa editores del boletín que no son miembros de
-- la Asamblea (role='member'). Los admin locales siempre pueden.
alter table public.profiles
  add column if not exists can_manage_bulletin boolean not null default false;

create or replace function public.has_bulletin_tag(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and can_manage_bulletin
  );
$$;

create table if not exists public.bulletins (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  title text not null,
  -- Texto editorial libre de la Asamblea (opcional).
  editorial text,
  -- Snapshot del contenido compilado: {events:[], announcements:[], photos:[]}.
  content jsonb not null default '{"events":[],"announcements":[],"photos":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- 64 hex chars aleatorios (dos uuid v4 sin guiones).
  share_token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bulletins_locality_idx
  on public.bulletins (locality_id, status, published_at desc);

alter table public.bulletins enable row level security;

-- Lectura: miembros de la localidad ven lo publicado; los gestores
-- (admin local o tag) ven también los borradores; el admin nacional ve
-- todo (solo lectura: no está en las policies de escritura).
drop policy if exists bulletins_select on public.bulletins;
create policy bulletins_select on public.bulletins
  for select to authenticated
  using (
    (status = 'published' and locality_id = public.current_locality_id())
    or (
      (public.is_admin(auth.uid()) or public.has_bulletin_tag(auth.uid()))
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );

-- Escritura: admin local o usuario con tag, siempre sobre SU localidad.
drop policy if exists bulletins_insert on public.bulletins;
create policy bulletins_insert on public.bulletins
  for insert to authenticated
  with check (
    (public.is_admin(auth.uid()) or public.has_bulletin_tag(auth.uid()))
    and locality_id = public.current_locality_id()
  );

drop policy if exists bulletins_update on public.bulletins;
create policy bulletins_update on public.bulletins
  for update to authenticated
  using (
    (public.is_admin(auth.uid()) or public.has_bulletin_tag(auth.uid()))
    and locality_id = public.current_locality_id()
  )
  with check (
    (public.is_admin(auth.uid()) or public.has_bulletin_tag(auth.uid()))
    and locality_id = public.current_locality_id()
  );

drop policy if exists bulletins_delete on public.bulletins;
create policy bulletins_delete on public.bulletins
  for delete to authenticated
  using (
    (public.is_admin(auth.uid()) or public.has_bulletin_tag(auth.uid()))
    and locality_id = public.current_locality_id()
  );
