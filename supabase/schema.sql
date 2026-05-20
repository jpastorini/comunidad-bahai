-- ─────────────────────────────────────────────────────────────────
-- Comunidad Bahá'í — Esquema base de Supabase
--
-- Ejecutar en el SQL Editor del proyecto Supabase tras crear la base.
-- Asume Supabase Auth para usuarios (auth.users) y RLS habilitado.
--
-- Modelo de permisos:
--   profiles.role: 'member' | 'admin'  (admin = miembro de la Asamblea)
--   profiles.can_respond_chat: tag para responder al chat de Secretaría
--   profiles.can_manage_treasury: tag para editar Tesorería
-- ─────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────
-- Perfiles
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  can_respond_chat boolean not null default false,
  can_manage_treasury boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- Un admin puede actualizar roles y tags de cualquier perfil.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─────────────────────────────────────────────────────────────────
-- Helpers de autorización
-- ─────────────────────────────────────────────────────────────────
create or replace function public.is_admin(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

create or replace function public.has_chat_tag(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and can_respond_chat
  );
$$;

create or replace function public.has_treasury_tag(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and can_manage_treasury
  );
$$;

-- Crea automáticamente un perfil cuando se registra un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- Mensajes (Casa Universal de Justicia)
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  title text not null,
  excerpt text not null,
  full_text text,
  is_new boolean not null default false,
  -- 'casa_universal' = mensaje de la Casa Universal de Justicia (sección Mensajes)
  -- 'asamblea_local' = comunicado de la Asamblea Local (sección Comunicados)
  source text not null default 'casa_universal'
    check (source in ('casa_universal', 'asamblea_local')),
  -- Campos adicionales para comunicados (Asamblea Local).
  subject text,        -- "Asunto" del comunicado
  pdf_url text,        -- PDF adjunto (Supabase Storage)
  image_url text,      -- Imagen de invitación adjunta
  created_at timestamptz not null default now()
);

create index if not exists messages_source_date_idx
  on public.messages (source, date desc);

alter table public.messages enable row level security;

drop policy if exists "messages_select_all" on public.messages;
create policy "messages_select_all" on public.messages
  for select using (true);

drop policy if exists "messages_admin_write" on public.messages;
create policy "messages_admin_write" on public.messages
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- Actividades locales
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.activities (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('estudio', 'devocional', 'ninos', 'jovenes')),
  title text not null,
  detail text not null,
  starts_at timestamptz not null,
  place text not null,
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;

drop policy if exists "activities_select_all" on public.activities;
create policy "activities_select_all" on public.activities
  for select using (true);

drop policy if exists "activities_admin_write" on public.activities;
create policy "activities_admin_write" on public.activities
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- Eventos de calendario
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  day int not null check (day between 1 and 31),
  month int not null check (month between 1 and 12),
  year int not null,
  title text not null,
  time text not null,         -- texto visible ("7:00 PM")
  color text not null,
  description text,            -- descripción larga del evento
  location text,               -- ubicación (también usada en el .ics)
  image_url text,              -- invitación gráfica (URL pública en Storage)
  duration_minutes int not null default 60, -- usado para DTEND del .ics
  activity_id uuid references public.activities(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select_all" on public.calendar_events;
create policy "calendar_events_select_all" on public.calendar_events
  for select using (true);

drop policy if exists "calendar_events_admin_write" on public.calendar_events;
create policy "calendar_events_admin_write" on public.calendar_events
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- Materiales de estudio
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.study_materials (
  id uuid primary key default uuid_generate_v4(),
  -- 'ruhi' / 'escritos' / 'oraciones' = items con PDF descargable
  -- 'oracion_del_mes' = imagen sharable que la Asamblea publica cada mes
  kind text not null check (kind in ('ruhi', 'escritos', 'oraciones', 'oracion_del_mes')),
  number int,
  title text not null,
  subtitle text,
  completed boolean not null default false,
  current boolean not null default false,
  pdf_url text,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists study_materials_kind_created_idx
  on public.study_materials (kind, created_at desc);

alter table public.study_materials enable row level security;

drop policy if exists "study_materials_select_all" on public.study_materials;
create policy "study_materials_select_all" on public.study_materials
  for select using (true);

drop policy if exists "study_materials_admin_write" on public.study_materials;
create policy "study_materials_admin_write" on public.study_materials
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- Metas de enseñanza
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.teaching_goals (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  current int not null default 0,
  goal int not null,
  color text not null,
  cycle text not null,
  created_at timestamptz not null default now()
);

alter table public.teaching_goals enable row level security;

drop policy if exists "teaching_goals_select_all" on public.teaching_goals;
create policy "teaching_goals_select_all" on public.teaching_goals
  for select using (true);

drop policy if exists "teaching_goals_admin_write" on public.teaching_goals;
create policy "teaching_goals_admin_write" on public.teaching_goals
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- Necesidades de servicio + voluntarios
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.service_needs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  urgency text not null check (urgency in ('alta', 'media', 'baja')),
  created_at timestamptz not null default now()
);

alter table public.service_needs enable row level security;

drop policy if exists "service_needs_select_all" on public.service_needs;
create policy "service_needs_select_all" on public.service_needs
  for select using (true);

drop policy if exists "service_needs_admin_write" on public.service_needs;
create policy "service_needs_admin_write" on public.service_needs
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create table if not exists public.service_volunteers (
  need_id uuid not null references public.service_needs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (need_id, user_id)
);

alter table public.service_volunteers enable row level security;

drop policy if exists "service_volunteers_select_all" on public.service_volunteers;
create policy "service_volunteers_select_all" on public.service_volunteers
  for select using (true);

drop policy if exists "service_volunteers_insert_self" on public.service_volunteers;
create policy "service_volunteers_insert_self" on public.service_volunteers
  for insert with check (auth.uid() = user_id);

drop policy if exists "service_volunteers_delete_self" on public.service_volunteers;
create policy "service_volunteers_delete_self" on public.service_volunteers
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- Tesorería (protegida por tag can_manage_treasury)
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.treasury (
  id uuid primary key default uuid_generate_v4(),
  goal_amount numeric not null,
  current_amount numeric not null default 0,
  period text not null,
  contributions jsonb not null default '[]'::jsonb,
  methods jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.treasury enable row level security;

drop policy if exists "treasury_select_all" on public.treasury;
create policy "treasury_select_all" on public.treasury
  for select using (true);

drop policy if exists "treasury_admin_write" on public.treasury;
drop policy if exists "treasury_tag_write" on public.treasury;
create policy "treasury_tag_write" on public.treasury
  for all
  using (public.has_treasury_tag(auth.uid()))
  with check (public.has_treasury_tag(auth.uid()));

-- ─────────────────────────────────────────────────────────────────
-- Chat con Secretaría
--
-- Un miembro tiene una "conversación" implícita: member_id = su user_id.
-- Los mensajes que ENVÍA el miembro tienen from_user_id = member_id.
-- Las respuestas de la Secretaría tienen from_user_id = admin que contesta
-- y member_id = el miembro destinatario.
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references auth.users(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  -- True when sent by an admin acting as Secretaría. Decouples display
  -- from "is the sender the same user as the member?" — useful when the
  -- same person tests as both member and admin.
  is_admin_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_member_idx
  on public.chat_messages (member_id, created_at);

alter table public.chat_messages enable row level security;

-- Limpiar políticas previas que pudieran existir.
drop policy if exists "chat_select_own_or_admin" on public.chat_messages;
drop policy if exists "chat_insert_self" on public.chat_messages;
drop policy if exists "chat_select_own" on public.chat_messages;
drop policy if exists "chat_select_admin_tag" on public.chat_messages;
drop policy if exists "chat_insert_member" on public.chat_messages;
drop policy if exists "chat_insert_admin_tag" on public.chat_messages;
drop policy if exists "chat_update_admin_tag" on public.chat_messages;

-- Un miembro lee su propia conversación.
create policy "chat_select_own" on public.chat_messages
  for select using (member_id = auth.uid());

-- Un admin con tag de chat lee TODAS las conversaciones.
create policy "chat_select_admin_tag" on public.chat_messages
  for select using (public.has_chat_tag(auth.uid()));

-- Un miembro envía mensajes en su propia conversación.
create policy "chat_insert_member" on public.chat_messages
  for insert with check (
    member_id = auth.uid() and from_user_id = auth.uid()
  );

-- Un admin con tag responde como Secretaría en cualquier conversación.
create policy "chat_insert_admin_tag" on public.chat_messages
  for insert with check (
    public.has_chat_tag(auth.uid()) and from_user_id = auth.uid()
  );

-- Marcar como leído.
create policy "chat_update_admin_tag" on public.chat_messages
  for update using (public.has_chat_tag(auth.uid()))
  with check (public.has_chat_tag(auth.uid()));

-- Realtime: habilitar replicación para chat_messages desde el dashboard
-- (Database -> Replication -> public.chat_messages).

-- ─────────────────────────────────────────────────────────────────
-- Fiesta de los Diecinueve Días
-- Ver supabase/migrations/007_feasts.sql para el esquema completo
-- (tablas: feasts, feast_locations, feast_prayers, feast_suggestions).
-- ─────────────────────────────────────────────────────────────────
