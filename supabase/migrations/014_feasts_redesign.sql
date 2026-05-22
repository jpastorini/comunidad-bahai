-- ═════════════════════════════════════════════════════════════════
-- Rediseño de Fiestas: ciclo de vida draft → published → in_progress,
-- fecha gregoriana oficial, restricción única por localidad.
--
-- IMPORTANTE: este migration BORRA todas las Fiestas existentes para
-- limpiar el estado de pruebas (la app está pre-producción). El usuario
-- aprobó este reset explícitamente durante la planificación.
--
-- Las 19 Fiestas se siembran luego automáticamente desde el panel admin
-- (ver lib/feasts.ts → ensureFeastsSeeded) cuando una Asamblea abre por
-- primera vez /admin/fiestas en cada año Badí'.
-- ═════════════════════════════════════════════════════════════════

-- 1. Limpiar datos (cascade borra locations, prayers, suggestions)
delete from public.feasts;

-- 2. Reemplazar constraint de status: 3 estados en lugar de 2
alter table public.feasts
  drop constraint if exists feasts_status_check;

alter table public.feasts
  alter column status set default 'draft';

alter table public.feasts
  add constraint feasts_status_check check (
    status in ('draft', 'published', 'in_progress')
  );

-- 3. Agregar fecha gregoriana oficial del día 1 del mes bahá'í.
-- La celebración es la noche anterior (atardecer del día previo).
alter table public.feasts
  add column if not exists gregorian_date date;

create index if not exists feasts_gregorian_date_idx
  on public.feasts (gregorian_date);

-- 4. Timestamp de cuando la Asamblea publicó la Fiesta a la comunidad.
alter table public.feasts
  add column if not exists published_at timestamptz;

-- 5. Constraint UNIQUE adaptada a multi-tenancy.
-- Cada localidad tiene su propia copia de cada Fiesta del año.
alter table public.feasts
  drop constraint if exists feasts_bahai_year_bahai_month_index_key;

create unique index if not exists feasts_locality_year_month_unique
  on public.feasts (locality_id, bahai_year, bahai_month_index);

-- 6. RLS: los miembros NO ven Fiestas en estado 'draft'.
-- Los admins de la localidad y los admins nacionales sí ven todo.
drop policy if exists "feasts_select_locality" on public.feasts;
create policy "feasts_select_locality" on public.feasts
  for select using (
    (
      locality_id = public.current_locality_id()
      and (
        status in ('published', 'in_progress')
        or public.is_admin(auth.uid())
      )
    )
    or public.is_national_admin(auth.uid())
  );
