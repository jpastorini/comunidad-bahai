-- 054 · Tesorería: cierre mensual, inmutabilidad, anulación de recibos,
--       datos fiscales en el recibo y el Balance anual como informe.
--
-- Qué pide la ley y qué resuelve cada parte (ver "Adecuación a la ley
-- uruguaya" en CLAUDE.md):
--
--  · El MEC exige un Libro Mayor de Caja con cierres MENSUALES y "sin
--    correcciones, tachaduras ni raspados". Acá eso es `treasury_closings`
--    (un cierre por localidad y mes civil, con los saldos congelados como
--    evidencia) más un trigger sobre `treasury_entries` que impide
--    insertar, modificar o borrar movimientos de un mes cerrado, y otro
--    sobre `treasury_attachments` que impide borrar sus comprobantes.
--    Una corrección es un CONTRA-ASIENTO en el mes abierto, que apunta al
--    original (`adjusts_entry_id`) y explica por qué.
--
--  · La DGI exige recibos correlativos. Un recibo emitido no se borra ni
--    se edita: se ANULA (`voided_at`, `void_reason`) y su número queda
--    ocupado en la serie. Un movimiento anulado no cuenta en ningún saldo.
--    El mismo trigger lo garantiza, para que ningún camino de escritura lo
--    saltee.
--
--  · El recibo debe llevar nombre registrado, RUT y domicilio fiscal
--    (Res. DGI 688/992 num. 22). `assembly_records` gana `fiscal_address`;
--    `my_receipt()` devuelve los tres datos para la copia del creyente.
--
--  · Los estatutos ordenan poner la memoria y el balance anual a
--    disposición de la comunidad desde el 17 de abril. El informe suma el
--    destinatario 'balance': lo lee cualquier creyente de la localidad
--    cuando está publicado, y nunca sale por el link público.
--
-- Antes de aplicar: ninguna fila existente cambia. Nada se cierra solo; el
-- tesorero cierra mes a mes desde /admin/tesoreria/libro/cierres.

-- ─── 1. Domicilio fiscal en la ficha legal ───────────────────────

alter table public.assembly_records
  add column if not exists fiscal_address text;

comment on column public.assembly_records.fiscal_address is
  'Domicilio fiscal registrado en DGI. Va impreso en el recibo y en el encabezado del balance.';

-- ─── 2. Anulación y contra-asiento en el libro ───────────────────

alter table public.treasury_entries
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists adjusts_entry_id uuid references public.treasury_entries(id) on delete set null,
  add column if not exists adjustment_reason text;

comment on column public.treasury_entries.voided_at is
  'Movimiento anulado. No cuenta en ningún saldo; su número de recibo queda ocupado en la serie.';
comment on column public.treasury_entries.adjusts_entry_id is
  'Este movimiento es un contra-asiento que revierte al indicado (que está en un mes cerrado).';

create index if not exists treasury_entries_adjusts_idx
  on public.treasury_entries (adjusts_entry_id)
  where adjusts_entry_id is not null;

create index if not exists treasury_entries_voided_idx
  on public.treasury_entries (locality_id, voided_at)
  where voided_at is not null;

-- ─── 3. Cierres mensuales ────────────────────────────────────────

create table if not exists public.treasury_closings (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  -- Primer día del mes civil cerrado.
  period_month date not null check (extract(day from period_month) = 1),
  status text not null default 'closed' check (status in ('closed', 'reopened')),
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  -- Los saldos por cuenta y moneda al cierre, como evidencia. El Libro
  -- de Caja se dibuja desde los movimientos (que el trigger congela) y
  -- compara contra esto; si difieren, lo dice en rojo.
  snapshot jsonb not null default '[]'::jsonb,
  entries_count int not null default 0,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  reopen_reason text,
  check (status = 'closed' or (reopened_at is not null and reopen_reason is not null))
);

comment on table public.treasury_closings is
  'Cierre mensual del libro (MEC: Libro Mayor de Caja con cierres mensuales). Un mes cerrado no admite altas, cambios ni bajas de movimientos.';

-- Un mes puede cerrarse, reabrirse y cerrarse otra vez: el reabierto
-- queda como historia y solo puede haber UN cierre vigente por mes.
create unique index if not exists treasury_closings_open_uniq
  on public.treasury_closings (locality_id, period_month)
  where status = 'closed';

create index if not exists treasury_closings_locality_idx
  on public.treasury_closings (locality_id, period_month desc, closed_at desc);

drop trigger if exists set_locality_treasury_closings on public.treasury_closings;
create trigger set_locality_treasury_closings
  before insert on public.treasury_closings
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_closings enable row level security;

drop policy if exists "treasury_closings_tag_all" on public.treasury_closings;
create policy "treasury_closings_tag_all" on public.treasury_closings
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ¿Está cerrado el mes al que pertenece esa fecha? Security definer para
-- que los triggers y las funciones de la comunidad puedan preguntarlo sin
-- depender de la RLS de quien escribe.
create or replace function public.treasury_month_is_closed(loc uuid, d date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.treasury_closings c
    where c.locality_id = loc
      and c.status = 'closed'
      and c.period_month = date_trunc('month', d)::date
  );
$$;

revoke all on function public.treasury_month_is_closed(uuid, date) from public;
grant execute on function public.treasury_month_is_closed(uuid, date) to authenticated;

-- ─── 4. El guardián del libro ────────────────────────────────────
--
-- Tres reglas, en este orden:
--   MES_CERRADO     — nada entra, cambia ni sale de un mes cerrado. La
--                     única excepción es marcar un recibo como emitido
--                     (imprimirlo después no cambia el libro).
--   ANULADO         — un movimiento anulado queda congelado.
--   RECIBO_EMITIDO  — un movimiento con recibo emitido no se borra ni se
--                     edita: se anula. El papel puede estar en manos del
--                     contribuyente y el libro tiene que decir lo mismo.
--
-- Los mensajes empiezan con el código en mayúsculas: el server action los
-- traduce a una frase para la persona.

create or replace function public.treasury_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Columnas que pueden cambiar en cualquier estado.
  always_ok text[] := array['updated_at', 'receipt_issued', 'receipt_issued_at', 'receipt_issued_by'];
  -- Además de las anteriores, lo que puede cambiar en un recibo emitido.
  void_ok text[] := array['voided_at', 'voided_by', 'void_reason'];
  changed text[];
  blocked int;
begin
  if tg_op = 'INSERT' then
    if public.treasury_month_is_closed(new.locality_id, new.entry_date) then
      raise exception 'MES_CERRADO: el mes de % está cerrado; cargá el movimiento en el mes abierto.',
        to_char(new.entry_date, 'MM/YYYY');
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.treasury_month_is_closed(old.locality_id, old.entry_date) then
      raise exception 'MES_CERRADO: el mes de % está cerrado; revertilo con un contra-asiento.',
        to_char(old.entry_date, 'MM/YYYY');
    end if;
    if old.receipt_issued then
      raise exception 'RECIBO_EMITIDO: el recibo N.º % ya fue emitido; anulalo en vez de borrarlo.',
        coalesce(old.receipt_number::text, '—');
    end if;
    return old;
  end if;

  -- UPDATE: qué columnas cambiaron de verdad.
  select coalesce(array_agg(n.key), '{}')
    into changed
  from jsonb_each(to_jsonb(new)) n
  where n.value is distinct from (to_jsonb(old) -> n.key);

  if public.treasury_month_is_closed(old.locality_id, old.entry_date)
     or public.treasury_month_is_closed(new.locality_id, new.entry_date) then
    select count(*) into blocked from unnest(changed) k where k <> all (always_ok);
    if blocked > 0 then
      raise exception 'MES_CERRADO: el mes de % está cerrado; revertilo con un contra-asiento.',
        to_char(old.entry_date, 'MM/YYYY');
    end if;
    return new;
  end if;

  if old.voided_at is not null then
    select count(*) into blocked from unnest(changed) k where k <> all (always_ok);
    if blocked > 0 then
      raise exception 'ANULADO: el movimiento está anulado y no se puede modificar.';
    end if;
    return new;
  end if;

  if old.receipt_issued then
    select count(*) into blocked from unnest(changed) k where k <> all (always_ok || void_ok);
    if blocked > 0 then
      raise exception 'RECIBO_EMITIDO: el recibo N.º % ya fue emitido; anulalo y cargá uno nuevo.',
        coalesce(old.receipt_number::text, '—');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists treasury_entries_guard on public.treasury_entries;
create trigger treasury_entries_guard
  before insert or update or delete on public.treasury_entries
  for each row execute function public.treasury_entries_guard();

-- El comprobante de un mes cerrado no se borra (sí se puede AGREGAR uno
-- que faltaba: eso mejora el respaldo sin cambiar el libro).
create or replace function public.treasury_attachments_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  select locality_id, entry_date into e
  from public.treasury_entries
  where id = old.entry_id;
  if found and public.treasury_month_is_closed(e.locality_id, e.entry_date) then
    raise exception 'MES_CERRADO: el comprobante pertenece a un mes cerrado y no se puede borrar.';
  end if;
  return old;
end;
$$;

drop trigger if exists treasury_attachments_guard on public.treasury_attachments;
create trigger treasury_attachments_guard
  before delete on public.treasury_attachments
  for each row execute function public.treasury_attachments_guard();

-- ─── 5. Los agregados dejan afuera lo anulado ────────────────────

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

  if not coalesce(loc = public.current_locality_id(), false)
     and not coalesce(public.is_national_admin(auth.uid()), false) then
    raise exception 'treasury_progress: esa localidad no es la tuya';
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

-- ─── 6. Mis aportes: el creyente ve el estado y los datos fiscales ─

-- Cambia el tipo de retorno: hay que borrarla antes de recrearla.
drop function if exists public.my_contributions();

create or replace function public.my_contributions()
returns table (
  id uuid,
  entry_date date,
  currency text,
  amount numeric,
  receipt_number int,
  receipt_name text,
  contributor_name text,
  fund_name text,
  subcategory_name text,
  locality_id uuid,
  locality_name text,
  voided_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id,
         e.entry_date,
         e.currency,
         e.amount,
         e.receipt_number,
         e.receipt_name,
         c.name,
         f.name,
         s.name,
         e.locality_id,
         l.name,
         e.voided_at
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  where auth.uid() is not null
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null
  order by e.entry_date desc, e.receipt_number desc nulls last;
$$;

revoke all on function public.my_contributions() from public;
grant execute on function public.my_contributions() to authenticated;

create or replace function public.my_receipt(entry_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'entry_date', e.entry_date,
    'currency', e.currency,
    'amount', e.amount,
    'receipt_number', e.receipt_number,
    'receipt_name', e.receipt_name,
    'contributor_name', c.name,
    'fund_name', f.name,
    'subcategory_name', s.name,
    'locality_name', l.name,
    'voided_at', e.voided_at,
    -- Los datos fiscales van impresos en TODO recibo, así que no son
    -- reservados: son los mismos que lee el contribuyente en el papel.
    'registered_name', a.registered_name,
    'rut', a.rut,
    'fiscal_address', a.fiscal_address,
    'treasurer_name', coalesce(
      (select p.full_name from public.profiles p where p.id = e.receipt_issued_by),
      (select p.full_name
         from public.profiles p
        where p.locality_id = e.locality_id
          and p.can_manage_treasury
          and p.disabled_at is null
        order by (p.role = 'admin') desc, p.created_at
        limit 1)
    )
  )
  from public.treasury_entries e
  join public.treasury_contributors c on c.id = e.contributor_id
  left join public.treasury_funds f on f.id = e.fund_id
  left join public.treasury_subcategories s on s.id = e.subcategory_id
  left join public.localities l on l.id = e.locality_id
  left join public.assembly_records a on a.locality_id = e.locality_id
  where e.id = entry_id
    and auth.uid() is not null
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null;
$$;

revoke all on function public.my_receipt(uuid) from public;
grant execute on function public.my_receipt(uuid) to authenticated;

-- ─── 7. El Balance anual como tercer destinatario del informe ────

alter table public.treasury_reports
  drop constraint if exists treasury_reports_audience_check;
alter table public.treasury_reports
  add constraint treasury_reports_audience_check
  check (audience in ('comunidad', 'internos', 'balance'));

-- Publicado, el balance lo lee cualquier creyente de la localidad
-- (estatutos, art. XI Agregado 3). El link público sigue siendo solo del
-- deck de la comunidad: eso lo filtra getPublicReport(), no la RLS.
drop policy if exists treasury_reports_select on public.treasury_reports;
create policy treasury_reports_select on public.treasury_reports
  for select to authenticated
  using (
    (
      status = 'published'
      and audience in ('comunidad', 'balance')
      and locality_id = public.current_locality_id()
    )
    or (
      status = 'published'
      and audience = 'internos'
      and public.is_admin(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or (
      public.has_treasury_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );
