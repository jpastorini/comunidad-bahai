-- 068 · Una meta se mide con VARIOS rubros del libro
--
-- Pedido el 2026-09-25, después de la 067 (lo mismo para el presupuesto).
-- Una meta declaraba un solo vínculo: un fondo, una categoría o una
-- subcategoría. Ahora son tres listas en la misma fila, con la misma
-- regla que ya tenía el vínculo único: se mide por RUBROS (categorías y
-- subcategorías) o, si no hay ninguno, por FONDOS. No se mezclan, porque
-- un gasto que está en el fondo Y en la categoría se contaría dos veces y
-- con los totales agregados no hay forma de saberlo.
--
-- Y dos arreglos a treasury_progress(), que hay que reescribir de todos
-- modos:
--
--   1. Una meta de INGRESO ("juntar") vinculada a una categoría o
--      subcategoría daba siempre cero: la función solo devolvía lo
--      recibido por fondo. Ahora devuelve también lo recibido por
--      categoría y por subcategoría ("Contrib. Fondo Enseñanza" es un
--      rubro de ingreso natural para una meta).
--   2. La 054 reescribió la función para excluir lo anulado y se perdió
--      el control de la 047: un Amigo/a de la Fe podía llamarla y leer
--      los totales. Vuelve.

alter table public.treasury_goals
  add column if not exists ledger_fund_ids uuid[] not null default '{}',
  add column if not exists ledger_category_ids uuid[] not null default '{}',
  add column if not exists ledger_subcategory_ids uuid[] not null default '{}';

-- Se copia SOLO el vínculo que mandaba (el más específico), igual que lo
-- leía la app: una meta con fondo y subcategoría se medía por la
-- subcategoría, y así se sigue midiendo.
update public.treasury_goals
set ledger_subcategory_ids = array[ledger_subcategory_id]
where ledger_subcategory_id is not null
  and cardinality(ledger_subcategory_ids) = 0;

update public.treasury_goals
set ledger_category_ids = array[ledger_category_id]
where ledger_category_id is not null
  and ledger_subcategory_id is null
  and cardinality(ledger_category_ids) = 0;

update public.treasury_goals
set ledger_fund_ids = array[ledger_fund_id]
where ledger_fund_id is not null
  and ledger_category_id is null
  and ledger_subcategory_id is null
  and cardinality(ledger_fund_ids) = 0;

-- Las columnas viejas quedan en NULL: si no, la app las sumaría a las
-- listas y un rubro no se podría quitar desde el editor.
update public.treasury_goals
set ledger_fund_id = null, ledger_category_id = null, ledger_subcategory_id = null
where ledger_fund_id is not null
   or ledger_category_id is not null
   or ledger_subcategory_id is not null;

-- ─── treasury_progress(): recibido por rubro + el guard de la 047 ───

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
  -- acceso se hace acá y a mano. Solo la propia localidad, y solo
  -- creyentes (047). Los coalesce() no son decorativos: ver 042.
  if not coalesce(loc = public.current_locality_id(), false)
     and not coalesce(public.is_national_admin(auth.uid()), false) then
    raise exception 'treasury_progress: esa localidad no es la tuya';
  end if;
  if not coalesce(public.is_bahai(auth.uid()), false)
     and not coalesce(public.is_national_admin(auth.uid()), false) then
    raise exception 'treasury_progress: sin acceso a la Tesorería';
  end if;

  with acumulado as (
    select fund_id, currency, amount
    from public.treasury_entries
    where locality_id = loc
      and entry_date <= as_of
      and voided_at is null
  ),
  flujo as (
    select entry_date, fund_id, category_id, subcategory_id, currency,
           amount, contributions_count
    from public.treasury_entries
    where locality_id = loc
      and entry_date >= year_from
      and entry_date <= as_of
      and not is_opening_balance
      and transfer_group_id is null
      and voided_at is null
  )
  select jsonb_build_object(
    'localityId', loc,
    'yearFrom', year_from,
    'asOf', as_of,

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

    'spentByCategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', category_id, 'c', currency, 'a', total))
      from (
        select category_id, currency, sum(-amount) as total
        from flujo where amount < 0
        group by category_id, currency
      ) t
    ), '[]'::jsonb),

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

    'receivedByCategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', category_id, 'c', currency, 'a', total))
      from (
        select category_id, currency, sum(amount) as total
        from flujo where amount > 0
        group by category_id, currency
      ) t
    ), '[]'::jsonb),

    'receivedBySubcategory', coalesce((
      select jsonb_agg(jsonb_build_object('id', subcategory_id, 'c', currency, 'a', total))
      from (
        select subcategory_id, currency, sum(amount) as total
        from flujo where amount > 0
        group by subcategory_id, currency
      ) t
    ), '[]'::jsonb),

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

revoke all on function public.treasury_progress(uuid, date, date) from public;
grant execute on function public.treasury_progress(uuid, date, date) to authenticated;
