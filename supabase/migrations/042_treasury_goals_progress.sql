-- ═════════════════════════════════════════════════════════════════
-- Metas de la Asamblea + agregados de progreso.
--
-- Dos cosas que van juntas porque sirven a la misma pantalla:
-- "¿cómo venimos respecto del presupuesto y de las metas?".
--
-- 1. `treasury_goals` — las metas dejan de ser texto.
--
--    Hasta ahora la meta ("Cachimba del Piojo · $ 3.500/mes · cubierto
--    ≈ 23 %") se tipeaba a mano en el editor del informe. Una barra de
--    progreso honesta necesita que la meta declare CONTRA QUÉ se mide,
--    igual que las líneas del presupuesto declaran con qué se ejecutan.
--
--    Dos ejes definen cómo se mide una meta:
--      · `direction` — 'gasto' para "financiar X" (se mide por lo que se
--        aplicó a ese rubro) e 'ingreso' para "juntar X" (se mide por lo
--        que entró a ese fondo).
--      · el vínculo con el libro: fondo, categoría o subcategoría. Manda
--        el más específico, igual que en el presupuesto.
--
--    `target_amount` puede ser NULL: "conseguir un POS propio" es una
--    meta real de la Asamblea y no tiene cifra. Esas se muestran como
--    tarjeta de estado, sin barra.
--
-- 2. `treasury_progress()` — los agregados para quien NO es tesorero.
--
--    El libro es exclusivo de quien tiene `can_manage_treasury`: un
--    creyente no lee `treasury_entries` ni por API directa. Pero la
--    pantalla de progreso es para toda la comunidad, así que los totales
--    salen por esta función security definer, que devuelve SOLO
--    agregados: ni un nombre de contribuyente, ni una fila del libro.
--
--    Los tramos de mes bahá'í y el borde del ejercicio (Riḍván) los sabe
--    el TypeScript, no el SQL: la función recibe `year_from` y `as_of` y
--    no duplica el calendario. Ver lib/treasury-year.ts.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── Metas ───────────────────────────────────────────────────────
create table if not exists public.treasury_goals (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  -- Ejercicio al que pertenece la meta (año administrativo, Riḍván a
  -- Riḍván). NULL = meta permanente, sin año.
  bahai_year int,
  title text not null,
  description text,
  -- NULL = meta sin cifra (una gestión, un proyecto en estudio).
  target_amount numeric(14, 2) check (target_amount is null or target_amount > 0),
  currency text not null default 'UYU' check (currency in ('UYU', 'USD')),
  -- Cada cuánto aplica el objetivo.
  cadence text not null default 'anual'
    check (cadence in ('mensual', 'anual', 'unica')),
  -- Cómo se mide el avance.
  direction text not null default 'gasto'
    check (direction in ('gasto', 'ingreso')),
  -- Vínculo con el libro. Manda el más específico de los tres.
  ledger_fund_id uuid references public.treasury_funds(id) on delete set null,
  ledger_category_id uuid references public.treasury_categories(id) on delete set null,
  ledger_subcategory_id uuid references public.treasury_subcategories(id) on delete set null,
  status text not null default 'activa'
    check (status in ('activa', 'lograda', 'archivada')),
  -- Etiqueta libre para las metas sin cifra ("En averiguación", "Al día").
  badge text,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_goals_locality_idx
  on public.treasury_goals (locality_id, status, sort_order);

drop trigger if exists set_locality_treasury_goals on public.treasury_goals;
create trigger set_locality_treasury_goals
  before insert on public.treasury_goals
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_goals enable row level security;

-- Lectura: cualquier creyente de la localidad. Son las metas públicas de
-- la Asamblea —las mismas que se presentan en la Fiesta— y no dicen nada
-- de lo que aportó nadie.
drop policy if exists treasury_goals_select on public.treasury_goals;
create policy treasury_goals_select on public.treasury_goals
  for select to authenticated
  using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists treasury_goals_tag_write on public.treasury_goals;
create policy treasury_goals_tag_write on public.treasury_goals
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Agregados de progreso ───────────────────────────────────────
--
-- Devuelve un jsonb con todo lo que la pantalla de progreso necesita, y
-- nada más que eso. Reglas de dominio, las mismas que el informe:
--
--   · Los FLUJOS (contribuciones, gastos) son del ejercicio: desde
--     `year_from` hasta `as_of`.
--   · Los SALDOS son acumulados: todo el libro hasta `as_of`, con los
--     saldos de apertura incluidos.
--   · Las TRANSFERENCIAS (transfer_group_id) no son ni ingreso ni gasto:
--     quedan fuera de los flujos, pero sí cuentan en los saldos, que es
--     su razón de ser.
--
-- Las contribuciones se agrupan POR FECHA (no por contribuyente) para
-- que el TypeScript pueda repartirlas en los tramos de mes bahá'í. Fecha
-- y monto es exactamente lo que el informe ya publica por número de
-- recibo, así que no revela nada nuevo.
create or replace function public.treasury_progress(
  loc uuid,
  year_from date,
  as_of date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if loc is null or year_from is null or as_of is null then
    raise exception 'treasury_progress: faltan parámetros';
  end if;

  -- Security definer: la función salta la RLS, así que el control de
  -- acceso se hace acá y a mano. Solo la propia localidad.
  --
  -- Los coalesce() no son decorativos: si el usuario no tiene localidad,
  -- `current_locality_id()` devuelve NULL, `loc <> NULL` da NULL y un IF
  -- sobre NULL no dispara. Sin esto, quien no tenga localidad asignada
  -- podría pedir los agregados de cualquier otra.
  if not coalesce(loc = public.current_locality_id(), false)
     and not coalesce(public.is_national_admin(auth.uid()), false) then
    raise exception 'treasury_progress: esa localidad no es la tuya';
  end if;

  with acumulado as (
    -- Para saldos: todo el libro hasta el cierre, sin excluir nada.
    select fund_id, currency, amount
    from public.treasury_entries
    where locality_id = loc
      and entry_date <= as_of
  ),
  flujo as (
    -- Para ingresos y gastos: solo el ejercicio, sin arrastre y sin
    -- transferencias.
    select entry_date, fund_id, category_id, subcategory_id, currency,
           amount, contributions_count
    from public.treasury_entries
    where locality_id = loc
      and entry_date >= year_from
      and entry_date <= as_of
      and not is_opening_balance
      and transfer_group_id is null
  )
  select jsonb_build_object(
    'localityId', loc,
    'yearFrom', year_from,
    'asOf', as_of,

    -- Contribuciones del ejercicio, por fecha y moneda.
    'contributionsByDate', coalesce((
      select jsonb_agg(jsonb_build_object(
               'd', entry_date, 'c', currency,
               'a', total, 'n', aportes))
      from (
        select entry_date, currency,
               sum(amount) as total,
               sum(greatest(contributions_count, 1)) as aportes
        from flujo
        where amount > 0
        group by entry_date, currency
      ) t
    ), '[]'::jsonb),

    -- Gastos del ejercicio por categoría del libro.
    'spentByCategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', category_id, 'c', currency, 'a', total))
      from (
        select category_id, currency, sum(-amount) as total
        from flujo where amount < 0
        group by category_id, currency
      ) t
    ), '[]'::jsonb),

    -- Ídem por subcategoría: el presupuesto y las metas se vinculan a
    -- una de las dos granularidades.
    'spentBySubcategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', subcategory_id, 'c', currency, 'a', total))
      from (
        select subcategory_id, currency, sum(-amount) as total
        from flujo where amount < 0
        group by subcategory_id, currency
      ) t
    ), '[]'::jsonb),

    'spentByFund', coalesce((
      select jsonb_agg(jsonb_build_object('id', fund_id, 'c', currency, 'a', total))
      from (
        select fund_id, currency, sum(-amount) as total
        from flujo where amount < 0 and fund_id is not null
        group by fund_id, currency
      ) t
    ), '[]'::jsonb),

    'receivedByFund', coalesce((
      select jsonb_agg(jsonb_build_object('id', fund_id, 'c', currency, 'a', total))
      from (
        select fund_id, currency, sum(amount) as total
        from flujo where amount > 0 and fund_id is not null
        group by fund_id, currency
      ) t
    ), '[]'::jsonb),

    -- Saldos acumulados por fondo.
    'balanceByFund', coalesce((
      select jsonb_agg(jsonb_build_object('id', fund_id, 'c', currency, 'a', total))
      from (
        select fund_id, currency, sum(amount) as total
        from acumulado where fund_id is not null
        group by fund_id, currency
        having abs(sum(amount)) >= 0.005
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Cualquier creyente autenticado puede pedirla; la función se encarga de
-- que solo devuelva datos de SU localidad.
revoke all on function public.treasury_progress(uuid, date, date) from public;
grant execute on function public.treasury_progress(uuid, date, date) to authenticated;
