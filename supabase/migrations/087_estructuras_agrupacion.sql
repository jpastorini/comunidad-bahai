-- ═════════════════════════════════════════════════════════════════
-- 087 · Zonas y agrupaciones, etapa B: estructuras de agrupación.
--
-- Decidido con el usuario el 2026-10-25. Una estructura puede ser local
-- (la crea una AEL), nacional (la crea la AEN) o DE AGRUPACIÓN: la crea la
-- AEN para una de las 20 agrupaciones (086). La Junta de Instituto es
-- solo nacional.
--
-- No hace falta un tipo nuevo: una estructura de agrupación es una
-- estructura de la Comunidad Nacional con `agrupacion_id` (la columna de
-- `localities` que la 086 creó para las AEL). Le presenta informes a la
-- AEN, su recibo dice que depende de la AEN, y todo lo de las 082–085
-- sigue igual. Lo que cambia es quién la ve:
--
-- 1. El guardián de `localities` (082) suma dos reglas: solo una
--    estructura de la AEN lleva agrupación, y nunca la Junta de Instituto.
-- 2. `institutional_calendar()` (085) pasa a tres familias:
--      · local      — una AEL y sus estructuras
--      · agrupación — las estructuras de una agrupación
--      · nacional   — la AEN y sus estructuras nacionales
--    Una estructura de agrupación la ven las instituciones de su
--    agrupación (sus AEL y las estructuras de esas AEL) y la AEN; ella ve
--    a las instituciones locales de su agrupación. Una AEL NO ve a las
--    otras AEL de su agrupación: eso no se pidió.
-- 3. "Mostrar en el calendario de la comunidad" (085), en una estructura
--    de agrupación, llega a los creyentes de esa agrupación
--    (`person_agrupacion()`, 086), y no a todo el país.
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. El guardián ──────────────────────────────────────────────

create or replace function public.localities_parent_guard()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.localities
    where id = new.parent_id and kind in ('ael', 'nacional')
  ) then
    raise exception 'MADRE_INVALIDA: una estructura depende de una Asamblea';
  end if;

  if new.kind = 'estructura' and new.agrupacion_id is not null then
    if not exists (
      select 1 from public.localities where id = new.parent_id and kind = 'nacional'
    ) then
      raise exception 'AGRUPACION_INVALIDA: solo la Asamblea Nacional crea estructuras de agrupación';
    end if;
    if new.structure_type = 'junta_instituto' then
      raise exception 'AGRUPACION_INVALIDA: la Junta de Instituto es solo nacional';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists localities_parent_guard on public.localities;
create trigger localities_parent_guard
  before insert or update of parent_id, agrupacion_id, structure_type on public.localities
  for each row execute function public.localities_parent_guard();

-- ─── 2. El calendario entre instituciones, con agrupación ────────

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
  with national as (
    select id from public.localities where kind = 'nacional' limit 1
  ),
  -- Cada institución con su familia y su agrupación. La de una
  -- estructura local es la de su AEL.
  inst as (
    select l.id, l.name, l.is_active,
           coalesce(l.parent_id, l.id) as root,
           case
             when l.kind = 'estructura' and l.agrupacion_id is not null then 'agrupacion'
             when coalesce(l.parent_id, l.id) = (select id from national) then 'nacional'
             else 'local'
           end as family,
           case
             when l.kind = 'estructura' and l.agrupacion_id is null then p.agrupacion_id
             else l.agrupacion_id
           end as agr
    from public.localities l
    left join public.localities p on p.id = l.parent_id
  ),
  -- Las instituciones donde la persona tiene rol de Asamblea.
  mine as (
    select i.*
    from public.profile_localities m
    join inst i on i.id = m.locality_id
    where m.profile_id = auth.uid() and m.role = 'admin'
  )
  select e.id, e.locality_id, i.name, i.family,
         e.day, e.month, e.year, e.title, e.time, e.kind, e.color,
         e.location, e.community_visible
  from public.calendar_events e
  join inst i on i.id = e.locality_id
  where exists (select 1 from mine)
    and e.locality_id is distinct from public.current_locality_id()
    and not coalesce(e.is_system_seeded, false)
    and i.is_active
    and make_date(e.year, e.month, e.day) between p_from and p_to
    and (
      -- Mi familia local: mi AEL y sus estructuras.
      (i.family = 'local' and i.root in (select root from mine where family = 'local'))
      -- Lo nacional, para cualquiera que trabaje en una institución.
      or i.family = 'nacional'
      -- Las estructuras de mi agrupación; la AEN ve las de todas.
      or (
        i.family = 'agrupacion'
        and (
          i.agr in (select agr from mine where agr is not null)
          or exists (select 1 from mine where id = (select id from national))
        )
      )
      -- Desde una estructura de agrupación, las instituciones locales de
      -- esa agrupación.
      or (i.family = 'local' and i.agr in (select agr from mine where family = 'agrupacion'))
    );
$$;

-- ─── 3. Mostrar en el calendario de la comunidad ─────────────────

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
        and (
          -- De agrupación: los creyentes de esa agrupación.
          (s.agrupacion_id is not null
            and s.agrupacion_id = public.person_agrupacion(auth.uid()))
          -- Local o nacional: la comunidad de la AEL, o todo el país.
          or (s.agrupacion_id is null
            and (p.id = public.current_locality_id() or p.kind = 'nacional'))
        )
    )
  );
