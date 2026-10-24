-- ═════════════════════════════════════════════════════════════════
-- 085 · Estructuras, etapa 4: el calendario entre instituciones.
--
-- Pedido del usuario (2026-10-24): que quienes trabajan en las
-- instituciones de una comunidad —la Asamblea y sus Comités,
-- Departamentos, Instituto— vean las actividades de todas, con un filtro
-- Locales / Nacionales / Ambas. Y que un evento de una estructura pueda
-- llegarle a la comunidad (el campamento del Comité de Juventud) con una
-- casilla, apagada por defecto.
--
-- 1. `calendar_events.community_visible`: la casilla. Una policy nueva
--    deja leer el evento de una estructura con la casilla marcada a la
--    comunidad de la Asamblea de la que depende, o a todo el país si
--    depende de la Nacional. Es la ÚNICA ampliación de la RLS de
--    `calendar_events`, y es a propósito: si la vista entre instituciones
--    también fuera por RLS, cada pantalla que lee el calendario —el del
--    creyente, el Inicio, los recordatorios— empezaría a mostrar las
--    reuniones de los comités.
-- 2. `institutional_calendar()`: lo de las OTRAS instituciones, solo
--    para el calendario del panel. Security definer, para quien tiene rol
--    de Asamblea en alguna institución: devuelve los eventos de las
--    instituciones de sus familias (la Asamblea y sus estructuras) y de
--    la familia nacional (la AEN y sus estructuras). Sin los Días
--    Sagrados, que cada Asamblea ya tiene sembrados.
--
-- Una "familia" es la Asamblea más sus estructuras: su raíz es
-- `coalesce(parent_id, id)`. La nacional es la que tiene por raíz a la
-- Comunidad Nacional.
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. Mostrar en el calendario de la comunidad ─────────────────

alter table public.calendar_events
  add column if not exists community_visible boolean not null default false;

drop policy if exists calendar_events_select_structure_public on public.calendar_events;
create policy calendar_events_select_structure_public on public.calendar_events
  for select using (
    community_visible
    and exists (
      select 1
      from public.localities s
      join public.localities p on p.id = s.parent_id
      where s.id = calendar_events.locality_id
        and s.kind = 'estructura'
        and (p.id = public.current_locality_id() or p.kind = 'nacional')
    )
  );

-- ─── 2. El calendario entre instituciones ────────────────────────

create or replace function public.institutional_calendar(p_from date, p_to date)
returns table (
  id uuid,
  locality_id uuid,
  institution text,
  family text,
  day int,
  month int,
  year int,
  title text,
  "time" text,
  kind text,
  color text,
  location text,
  community_visible boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with my_roots as (
    -- Las familias donde la persona tiene rol de Asamblea.
    select distinct coalesce(l.parent_id, l.id) as root
    from public.profile_localities m
    join public.localities l on l.id = m.locality_id
    where m.profile_id = auth.uid() and m.role = 'admin'
  ),
  national as (
    select id from public.localities where kind = 'nacional' limit 1
  )
  select e.id, e.locality_id, l.name,
         case when coalesce(l.parent_id, l.id) = (select id from national)
              then 'nacional' else 'local' end,
         e.day, e.month, e.year, e.title, e.time, e.kind, e.color,
         e.location, e.community_visible
  from public.calendar_events e
  join public.localities l on l.id = e.locality_id
  where exists (select 1 from my_roots)
    and e.locality_id is distinct from public.current_locality_id()
    and not coalesce(e.is_system_seeded, false)
    and l.is_active
    and make_date(e.year, e.month, e.day) between p_from and p_to
    and (
      coalesce(l.parent_id, l.id) in (select root from my_roots)
      or coalesce(l.parent_id, l.id) = (select id from national)
    );
$$;

revoke all on function public.institutional_calendar(date, date) from public, anon;
grant execute on function public.institutional_calendar(date, date) to authenticated;
