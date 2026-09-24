-- 063 — El compromiso con el Fondo es de una comunidad, y avisa el 10.
--
-- Los compromisos son de la migración 011, anterior a la multi-tenencia
-- (021), al libro contable (040) y a la Comunidad Nacional (056). De ahí
-- las tres cosas que arregla esta migración:
--
-- 1. No tenían `locality_id`, y su policy de lectura era
--    `has_treasury_tag(auth.uid())` a secas: con la Tesorería Nacional
--    andando, el tesorero de CUALQUIER comunidad leía los compromisos de
--    todo el país. Un compromiso es con el Fondo de una comunidad; la
--    RLS pasa a decirlo, con el mismo molde que el libro (040).
-- 2. La PK era `user_id`: una sola declaración por persona en todo el
--    sistema. Quien pertenece a su AEL y a la Comunidad Nacional (055)
--    puede sostener las dos, así que la PK pasa a ser (user_id,
--    locality_id) — una por comunidad.
-- 3. El monto no declaraba moneda. Se asumía UYU en toda la app; ahora
--    lo dice, porque el informe compara contra el libro y "nunca sumar
--    monedas distintas" necesita saber cuál es cuál.
--
-- Suma además `last_reminder_sent_at`, que es lo que impide que el aviso
-- del día 10 salga dos veces si el cron se reintenta.
--
-- Correr una vez en el SQL Editor de Supabase.

alter table public.treasury_commitments
  add column if not exists locality_id uuid references public.localities(id) on delete cascade,
  add column if not exists currency text not null default 'UYU',
  add column if not exists last_reminder_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'treasury_commitments_currency_check'
  ) then
    alter table public.treasury_commitments
      add constraint treasury_commitments_currency_check
      check (currency in ('UYU', 'USD'));
  end if;
end $$;

-- La comunidad de cada compromiso viejo es la que la persona tenía puesta
-- cuando lo declaró, o sea su localidad actual.
update public.treasury_commitments c
set locality_id = p.locality_id
from public.profiles p
where c.user_id = p.id
  and c.locality_id is null
  and p.locality_id is not null;

-- Un compromiso sin comunidad no se puede pagar a ningún Fondo: no hay a
-- qué libro compararlo ni qué tesorero puede verlo. Se borran (son de
-- perfiles que nunca eligieron localidad).
delete from public.treasury_commitments where locality_id is null;

alter table public.treasury_commitments alter column locality_id set not null;

-- PK (user_id, locality_id): una declaración por comunidad.
alter table public.treasury_commitments
  drop constraint if exists treasury_commitments_pkey;
alter table public.treasury_commitments
  add constraint treasury_commitments_pkey primary key (user_id, locality_id);

create index if not exists treasury_commitments_locality_idx
  on public.treasury_commitments (locality_id);

-- ─── RLS ─────────────────────────────────────────────────────────
-- El dueño sigue siendo dueño de sus filas (cualquiera sea la comunidad).
-- Lo que cambia es el tesorero: solo los de SU comunidad, igual que el
-- libro. A propósito sin `is_national_admin`: ese flag da acceso a los
-- nombres de contribuyentes de todo el país y acá no hace falta.
drop policy if exists "tc_treasurer_select" on public.treasury_commitments;
create policy "tc_treasurer_select" on public.treasury_commitments
  for select using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- El cron del día 10 escribe `last_reminder_sent_at` con service-role,
-- que ignora la RLS: no hace falta ninguna policy de update extra.

-- El dueño declara su compromiso con la comunidad que tiene puesta: sin
-- esto podría escribir una fila con el `locality_id` de otra, que el
-- tesorero de allá vería como propia.
drop policy if exists "tc_owner_insert" on public.treasury_commitments;
create policy "tc_owner_insert" on public.treasury_commitments
  for insert with check (
    user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );

drop policy if exists "tc_owner_update" on public.treasury_commitments;
create policy "tc_owner_update" on public.treasury_commitments
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and locality_id = public.current_locality_id()
  );
