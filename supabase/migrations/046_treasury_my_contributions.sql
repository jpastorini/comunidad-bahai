-- ═════════════════════════════════════════════════════════════════
-- 046 — Mis aportes: el creyente ve sus contribuciones y baja el recibo
--
-- Hasta acá el vínculo contribuyente ↔ creyente existía en el modelo
-- (`treasury_contributors.profile_id`, migración 040) pero el formulario
-- nunca lo llenaba, así que un aporte no le pertenecía a nadie más que
-- al libro. Esta migración cierra el circuito con tres piezas:
--
-- 1. `treasury_entries.receipt_name` — el seudónimo POR APORTE. Muchas
--    veces una persona aporta en nombre de su familia y quiere que el
--    recibo reconozca a la familia. Se guarda en el asiento y no como
--    un contribuyente aparte, por dos razones: el libro sigue sabiendo
--    quién aportó (el contribuyente), y si los dos cónyuges están en la
--    app y se alternan, cada uno ve los aportes que hizo, cosa que un
--    contribuyente "Familia X" atado a un solo perfil no permite (el
--    índice único por nombre no deja dos). El recibo imprime el
--    seudónimo si existe y el nombre del contribuyente si no.
--
-- 2. `treasury_entries.receipt_issued_by` — quién emitió el recibo. La
--    firma del recibo llevaba el nombre de quien lo estaba MIRANDO, que
--    para la copia que baja el creyente no sirve.
--
-- 3. Dos funciones security definer, `my_contributions()` y
--    `my_receipt()`, con el mismo criterio que `treasury_progress()`:
--    el libro sigue siendo exclusivo del tesorero (la RLS de
--    `treasury_entries` no cambia) y el creyente recibe SOLO las filas
--    cuyo contribuyente apunta a su propio perfil, y solo las columnas
--    que hacen falta para la lista y para el recibo. Un aporte en la
--    canasta de la Fiesta no tiene perfil y nunca aparece.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

alter table public.treasury_entries
  add column if not exists receipt_name text,
  add column if not exists receipt_issued_by uuid
    references auth.users(id) on delete set null;

comment on column public.treasury_entries.receipt_name is
  'Cómo figura el contribuyente en el recibo de ESTE aporte (p. ej. "Familia Pérez"). NULL = el nombre del contribuyente.';
comment on column public.treasury_entries.receipt_issued_by is
  'Quién emitió el recibo. Su nombre va en la firma de la copia que baja el creyente.';

-- ─── Mis aportes ─────────────────────────────────────────────────
-- Todas las contribuciones cuyo contribuyente está vinculado al perfil de
-- quien pregunta, sin recortar por año: son pocas filas por persona y el
-- corte por ejercicio (Riḍván a Riḍván) lo sabe el TypeScript, igual que
-- en treasury_progress(). Ver lib/treasury-year.ts.
--
-- Quedan afuera los gastos, los saldos de apertura y las transferencias:
-- nada de eso es un aporte de nadie.
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
  locality_name text
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
         l.name
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

-- ─── Mi recibo ───────────────────────────────────────────────────
-- Lo que hace falta para imprimir la hoja A5 de UN aporte propio. La
-- firma lleva a quien emitió el recibo; si nadie lo marcó emitido
-- todavía, al tesorero actual de esa localidad (el primero con el tag).
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
  where e.id = entry_id
    and auth.uid() is not null
    and c.profile_id = auth.uid()
    and e.amount > 0
    and not e.is_opening_balance
    and e.transfer_group_id is null;
$$;

revoke all on function public.my_receipt(uuid) from public;
grant execute on function public.my_receipt(uuid) to authenticated;
