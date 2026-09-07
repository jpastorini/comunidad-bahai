-- ═════════════════════════════════════════════════════════════════
-- 049 · Uso de la app: estadística básica por localidad.
--
-- Cada Asamblea Local quiere saber cómo usa la comunidad la app:
-- cuántos la tienen instalada, cuántos entran y con qué regularidad,
-- y qué partes se usan más. Hasta ahora no había ninguna medición.
--
-- El dato es `usage_daily`: UNA fila por (persona, día, sección) con
-- un contador. No se guarda cada toque ni la hora: el día alcanza para
-- regularidad y secciones, y es mucho menos invasivo que un registro
-- de navegación. La escribe solo `record_usage()` (security definer,
-- con la identidad del que llama): nadie puede anotar uso ajeno y el
-- cliente no tiene policy de insert.
--
-- "Instalada" (`profiles.pwa_installed_at`) se anota la primera vez que
-- la app corre en modo standalone. Es una aproximación honesta: quien
-- instaló y nunca la abrió cuenta como no instalada.
--
-- Los agregados salen por tres funciones SQL (security INVOKER: la RLS
-- de usage_daily decide qué filas ve cada Asamblea), porque un año de
-- una localidad grande son decenas de miles de filas y PostgREST corta
-- en mil.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. Instalada ──────────────────────────────────────────────────
-- Personal, no privilegiada: `profiles_update_self` no cambia. La
-- escribe record_usage() de todos modos.

alter table public.profiles
  add column if not exists pwa_installed_at timestamptz;

-- ─── 2. Uso diario ─────────────────────────────────────────────────

create table if not exists public.usage_daily (
  locality_id uuid references public.localities(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  section     text not null check (section ~ '^[a-z_]{1,32}$'),
  hits        integer not null default 1,
  primary key (profile_id, day, section)
);

create index if not exists usage_daily_locality_day_idx
  on public.usage_daily (locality_id, day);

alter table public.usage_daily enable row level security;

-- Lee la Asamblea de la localidad (rol admin) y el admin nacional. La
-- propia persona no necesita leer su uso, y nadie inserta por API: la
-- única puerta de escritura es record_usage().
drop policy if exists "usage_daily_select_admin" on public.usage_daily;
create policy "usage_daily_select_admin" on public.usage_daily
  for select to authenticated
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 3. Registrar uso ──────────────────────────────────────────────
--
-- El día es el civil de la app (Montevideo), no el del servidor ni el
-- del celular: así "hoy" significa lo mismo para toda la comunidad y
-- coincide con la Lectura de hoy y el resto de los cortes diarios.

create or replace function public.record_usage(
  p_section text,
  p_standalone boolean default false
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  loc   uuid;
  today date;
begin
  if uid is null then return; end if;
  if p_section is null or p_section !~ '^[a-z_]{1,32}$' then return; end if;

  select locality_id into loc from public.profiles where id = uid;
  if loc is null then return; end if; -- todavía no eligió localidad

  today := (now() at time zone 'America/Montevideo')::date;

  insert into public.usage_daily (locality_id, profile_id, day, section)
  values (loc, uid, today, p_section)
  on conflict (profile_id, day, section)
    do update set hits = public.usage_daily.hits + 1;

  if p_standalone then
    update public.profiles
       set pwa_installed_at = now()
     where id = uid and pwa_installed_at is null;
  end if;
end;
$$;

revoke all on function public.record_usage(text, boolean) from public;
grant execute on function public.record_usage(text, boolean) to authenticated;

-- ─── 4. Agregados para el informe ──────────────────────────────────
-- Security invoker a propósito: corren con la RLS de quien pregunta.

create or replace function public.usage_by_section(p_from date, p_to date)
returns table (section text, hits bigint, people bigint)
language sql stable
set search_path = public
as $$
  select u.section,
         sum(u.hits)::bigint            as hits,
         count(distinct u.profile_id)::bigint as people
    from public.usage_daily u
   where u.day between p_from and p_to
   group by u.section
   order by hits desc;
$$;

create or replace function public.usage_by_day(p_from date, p_to date)
returns table (day date, people bigint, hits bigint)
language sql stable
set search_path = public
as $$
  select u.day,
         count(distinct u.profile_id)::bigint as people,
         sum(u.hits)::bigint                  as hits
    from public.usage_daily u
   where u.day between p_from and p_to
   group by u.day
   order by u.day;
$$;

create or replace function public.usage_by_person(p_from date, p_to date)
returns table (profile_id uuid, active_days bigint, hits bigint, last_day date)
language sql stable
set search_path = public
as $$
  select u.profile_id,
         count(distinct u.day)::bigint as active_days,
         sum(u.hits)::bigint           as hits,
         max(u.day)                    as last_day
    from public.usage_daily u
   where u.day between p_from and p_to
   group by u.profile_id;
$$;

grant execute on function public.usage_by_section(date, date) to authenticated;
grant execute on function public.usage_by_day(date, date) to authenticated;
grant execute on function public.usage_by_person(date, date) to authenticated;
