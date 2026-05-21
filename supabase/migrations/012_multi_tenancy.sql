-- ═════════════════════════════════════════════════════════════════
-- Multi-tenancy por localidad.
--
-- Cada Asamblea Espiritual Local opera como un tenant aislado.
-- - Tabla `localities` con todas las comunidades activas
-- - Cada perfil pertenece a una localidad (locality_id) y opcionalmente
--   tiene el flag is_national_admin (puede gestionar localidades)
-- - Cada tabla de contenido gana locality_id NOT NULL
-- - RLS filtra automáticamente por la localidad del usuario
-- - Trigger set_locality_from_auth() copia la locality_id desde el perfil
--   del usuario que hace el INSERT, así los admins no tienen que pensar
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. Tabla localities ─────────────────────────────────────────
create table if not exists public.localities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                  -- "Comunidad Bahá'í de Montevideo"
  city text,                            -- ciudad o barrio
  country text not null default 'Uruguay',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists localities_name_unique
  on public.localities (lower(name));

alter table public.localities enable row level security;

-- Cualquiera puede listar localidades activas (necesario para el selector).
drop policy if exists "localities_select_all" on public.localities;
create policy "localities_select_all" on public.localities
  for select using (true);

-- Solo Admin Nacional puede modificar.
drop policy if exists "localities_national_write" on public.localities;
create policy "localities_national_write" on public.localities
  for all
  using (
    coalesce((select is_national_admin from public.profiles where id = auth.uid()), false)
  )
  with check (
    coalesce((select is_national_admin from public.profiles where id = auth.uid()), false)
  );

-- Localidad por defecto: para preservar los datos actuales del testing.
insert into public.localities (name, city, country)
values ('Comunidad Bahá''í de Montevideo', 'Montevideo', 'Uruguay')
on conflict do nothing;

-- ─── 2. Profiles: locality_id + is_national_admin ────────────────
alter table public.profiles
  add column if not exists locality_id uuid references public.localities(id) on delete set null,
  add column if not exists is_national_admin boolean not null default false;

-- Backfill: todos los perfiles existentes → Montevideo
update public.profiles
set locality_id = (select id from public.localities limit 1)
where locality_id is null;

-- Política nueva: Admin Nacional puede editar cualquier perfil (asignar
-- localidad, promover a admin, etc.)
drop policy if exists "profiles_national_update" on public.profiles;
create policy "profiles_national_update" on public.profiles
  for update
  using (
    coalesce((select is_national_admin from public.profiles where id = auth.uid()), false)
  )
  with check (
    coalesce((select is_national_admin from public.profiles where id = auth.uid()), false)
  );

-- ─── 3. Helpers de auth ──────────────────────────────────────────
create or replace function public.current_locality_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select locality_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_national_admin(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select is_national_admin from public.profiles where id = uid),
    false
  );
$$;

-- ─── 4. Trigger genérico: auto-llenar locality_id ────────────────
-- Si la fila se inserta sin locality_id explícita, copia la del perfil
-- del usuario logueado. Esto evita que el código de la app tenga que
-- pasarla manualmente en cada insert.
create or replace function public.set_locality_from_auth()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.locality_id is null then
    new.locality_id := public.current_locality_id();
  end if;
  return new;
end;
$$;

-- ─── 5. Aplicar a cada tabla de tenant ───────────────────────────
-- Helper macro: agrega columna, backfill, NOT NULL, índice, trigger,
-- y reemplaza RLS por versión locality-aware.

-- ── messages ──
alter table public.messages
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.messages set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.messages alter column locality_id set not null;
create index if not exists messages_locality_idx on public.messages (locality_id);
drop trigger if exists messages_set_locality on public.messages;
create trigger messages_set_locality before insert on public.messages
  for each row execute function public.set_locality_from_auth();

drop policy if exists "messages_select_all" on public.messages;
drop policy if exists "messages_select_locality" on public.messages;
create policy "messages_select_locality" on public.messages
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "messages_admin_write" on public.messages;
create policy "messages_admin_write" on public.messages
  for all
  using (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.is_admin(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ── activities ──
alter table public.activities
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.activities set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.activities alter column locality_id set not null;
create index if not exists activities_locality_idx on public.activities (locality_id);
drop trigger if exists activities_set_locality on public.activities;
create trigger activities_set_locality before insert on public.activities
  for each row execute function public.set_locality_from_auth();

drop policy if exists "activities_select_all" on public.activities;
create policy "activities_select_locality" on public.activities
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "activities_admin_write" on public.activities;
create policy "activities_admin_write" on public.activities
  for all
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

-- ── calendar_events ──
alter table public.calendar_events
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.calendar_events set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.calendar_events alter column locality_id set not null;
create index if not exists calendar_events_locality_idx on public.calendar_events (locality_id);
drop trigger if exists calendar_events_set_locality on public.calendar_events;
create trigger calendar_events_set_locality before insert on public.calendar_events
  for each row execute function public.set_locality_from_auth();

drop policy if exists "calendar_events_select_all" on public.calendar_events;
create policy "calendar_events_select_locality" on public.calendar_events
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "calendar_events_admin_write" on public.calendar_events;
create policy "calendar_events_admin_write" on public.calendar_events
  for all
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

-- ── study_materials ──
alter table public.study_materials
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.study_materials set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.study_materials alter column locality_id set not null;
create index if not exists study_materials_locality_idx on public.study_materials (locality_id);
drop trigger if exists study_materials_set_locality on public.study_materials;
create trigger study_materials_set_locality before insert on public.study_materials
  for each row execute function public.set_locality_from_auth();

drop policy if exists "study_materials_select_all" on public.study_materials;
create policy "study_materials_select_locality" on public.study_materials
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "study_materials_admin_write" on public.study_materials;
create policy "study_materials_admin_write" on public.study_materials
  for all
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

-- ── service_needs ──
alter table public.service_needs
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.service_needs set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.service_needs alter column locality_id set not null;
create index if not exists service_needs_locality_idx on public.service_needs (locality_id);
drop trigger if exists service_needs_set_locality on public.service_needs;
create trigger service_needs_set_locality before insert on public.service_needs
  for each row execute function public.set_locality_from_auth();

drop policy if exists "service_needs_select_all" on public.service_needs;
create policy "service_needs_select_locality" on public.service_needs
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "service_needs_admin_write" on public.service_needs;
create policy "service_needs_admin_write" on public.service_needs
  for all
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());

-- ── treasury ──
alter table public.treasury
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.treasury set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.treasury alter column locality_id set not null;
create index if not exists treasury_locality_idx on public.treasury (locality_id);
drop trigger if exists treasury_set_locality on public.treasury;
create trigger treasury_set_locality before insert on public.treasury
  for each row execute function public.set_locality_from_auth();

drop policy if exists "treasury_select_all" on public.treasury;
create policy "treasury_select_locality" on public.treasury
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_tag_write" on public.treasury;
create policy "treasury_tag_write" on public.treasury
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ── treasury_commitments ──
alter table public.treasury_commitments
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.treasury_commitments set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.treasury_commitments alter column locality_id set not null;
create index if not exists treasury_commitments_locality_idx on public.treasury_commitments (locality_id);
drop trigger if exists treasury_commitments_set_locality on public.treasury_commitments;
create trigger treasury_commitments_set_locality before insert on public.treasury_commitments
  for each row execute function public.set_locality_from_auth();

-- (Las políticas owner_* siguen igual; agregamos restricción de localidad
-- al tesorero.)
drop policy if exists "tc_treasurer_select" on public.treasury_commitments;
create policy "tc_treasurer_select" on public.treasury_commitments
  for select using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ── chat_messages ──
alter table public.chat_messages
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.chat_messages set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.chat_messages alter column locality_id set not null;
create index if not exists chat_messages_locality_idx on public.chat_messages (locality_id);
drop trigger if exists chat_messages_set_locality on public.chat_messages;
create trigger chat_messages_set_locality before insert on public.chat_messages
  for each row execute function public.set_locality_from_auth();

-- chat ya restringe por member_id; agregamos chequeo de localidad para
-- el admin que responde.
drop policy if exists "chat_select_admin_tag" on public.chat_messages;
create policy "chat_select_admin_tag" on public.chat_messages
  for select using (
    public.has_chat_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

drop policy if exists "chat_insert_admin_tag" on public.chat_messages;
create policy "chat_insert_admin_tag" on public.chat_messages
  for insert with check (
    public.has_chat_tag(auth.uid())
    and from_user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );

drop policy if exists "chat_update_admin_tag" on public.chat_messages;
create policy "chat_update_admin_tag" on public.chat_messages
  for update using (
    public.has_chat_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_chat_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ── feasts ──
alter table public.feasts
  add column if not exists locality_id uuid references public.localities(id) on delete cascade;
update public.feasts set locality_id = (select id from public.localities limit 1) where locality_id is null;
alter table public.feasts alter column locality_id set not null;
create index if not exists feasts_locality_idx on public.feasts (locality_id);
drop trigger if exists feasts_set_locality on public.feasts;
create trigger feasts_set_locality before insert on public.feasts
  for each row execute function public.set_locality_from_auth();

drop policy if exists "feasts_select_all" on public.feasts;
create policy "feasts_select_locality" on public.feasts
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "feasts_admin_write" on public.feasts;
create policy "feasts_admin_write" on public.feasts
  for all
  using (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
  with check (public.is_admin(auth.uid()) and locality_id = public.current_locality_id());
