-- Módulo Fiesta de los Diecinueve Días
--
-- Cada Fiesta (uno por mes bahá'í, ~19 días) puede celebrarse en
-- múltiples lugares con distintas fechas/horas. Tiene un estado
-- (por iniciar / iniciada) que controla qué ven los miembros.
-- Cuando inicia, el programa y la tesorería del mes están disponibles.
--
-- Run once in the Supabase SQL Editor.

-- ─── Feast ────────────────────────────────────────────────────────
create table if not exists public.feasts (
  id uuid primary key default uuid_generate_v4(),

  -- Identidad bahá'í
  bahai_month_name text not null,            -- ej. "Núr"
  bahai_month_index int not null check (bahai_month_index between 1 and 19),
  bahai_year int not null,                   -- ej. 183

  -- Estado
  status text not null default 'upcoming'
    check (status in ('upcoming', 'in_progress')),
  started_at timestamptz,                    -- cuando la Asamblea inicia la Fiesta

  -- Programa (visible cuando status='in_progress')
  deepening_theme text,
  deepening_content text,
  international_reports text,
  national_reports text,
  local_reports text,
  assembly_communique text,

  -- Tesorería del mes (Fondo Local)
  treasury_income numeric,
  treasury_expenses numeric,
  treasury_final numeric,
  treasury_pdf_url text,

  created_at timestamptz not null default now(),
  unique (bahai_year, bahai_month_index)
);

alter table public.feasts enable row level security;

drop policy if exists "feasts_select_all" on public.feasts;
create policy "feasts_select_all" on public.feasts
  for select using (true);

drop policy if exists "feasts_admin_write" on public.feasts;
create policy "feasts_admin_write" on public.feasts
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── Locations ────────────────────────────────────────────────────
create table if not exists public.feast_locations (
  id uuid primary key default uuid_generate_v4(),
  feast_id uuid not null references public.feasts(id) on delete cascade,
  name text not null,                        -- "Casa García"
  address text,
  starts_at timestamptz not null,
  notes text,                                -- ej. "Devocional canta-juntos"
  created_at timestamptz not null default now()
);

create index if not exists feast_locations_feast_idx
  on public.feast_locations (feast_id);

alter table public.feast_locations enable row level security;

drop policy if exists "feast_locations_select_all" on public.feast_locations;
create policy "feast_locations_select_all" on public.feast_locations
  for select using (true);

drop policy if exists "feast_locations_admin_write" on public.feast_locations;
create policy "feast_locations_admin_write" on public.feast_locations
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── Prayers (parte del programa) ─────────────────────────────────
create table if not exists public.feast_prayers (
  id uuid primary key default uuid_generate_v4(),
  feast_id uuid not null references public.feasts(id) on delete cascade,
  position int not null default 0,
  title text,                                -- ej. "Oración por la unidad"
  reference text,                            -- ej. "Bahá'u'lláh"
  body text not null,                        -- el texto de la oración
  created_at timestamptz not null default now()
);

create index if not exists feast_prayers_feast_idx
  on public.feast_prayers (feast_id, position);

alter table public.feast_prayers enable row level security;

drop policy if exists "feast_prayers_select_all" on public.feast_prayers;
create policy "feast_prayers_select_all" on public.feast_prayers
  for select using (true);

drop policy if exists "feast_prayers_admin_write" on public.feast_prayers;
create policy "feast_prayers_admin_write" on public.feast_prayers
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─── Suggestions ──────────────────────────────────────────────────
-- Los miembros dejan sugerencias durante la Fiesta. Solo los miembros
-- de la Asamblea (admins) las leen en su reunión administrativa.
create table if not exists public.feast_suggestions (
  id uuid primary key default uuid_generate_v4(),
  feast_id uuid not null references public.feasts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  detail text not null,
  reviewed boolean not null default false,   -- marca de la Asamblea
  created_at timestamptz not null default now()
);

create index if not exists feast_suggestions_feast_idx
  on public.feast_suggestions (feast_id, created_at desc);

alter table public.feast_suggestions enable row level security;

-- Miembros pueden insertar sus propias sugerencias.
drop policy if exists "feast_suggestions_insert_self" on public.feast_suggestions;
create policy "feast_suggestions_insert_self" on public.feast_suggestions
  for insert with check (user_id = auth.uid());

-- Un miembro puede ver sus propias sugerencias (para feedback "enviada").
drop policy if exists "feast_suggestions_select_own" on public.feast_suggestions;
create policy "feast_suggestions_select_own" on public.feast_suggestions
  for select using (user_id = auth.uid());

-- Admins ven y gestionan todas las sugerencias.
drop policy if exists "feast_suggestions_admin_all" on public.feast_suggestions;
create policy "feast_suggestions_admin_all" on public.feast_suggestions
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
