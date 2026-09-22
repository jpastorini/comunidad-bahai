-- ═════════════════════════════════════════════════════════════════
-- 062 · Importar los ejercicios anteriores al libro.
--
-- La Tesorería Nacional tiene cinco años de planillas y un libro vacío.
-- Cargarlos a mano no es opción, y el valor está justamente en tenerlos
-- adentro: la auditoría (059), el Libro de Caja (054) y los informes
-- leen el libro, así que un año importado se audita igual que el actual.
--
-- Tres piezas:
--
--  · El LOTE (`treasury_ledger_imports`) es evidencia y es la unidad de
--    deshacer: qué archivo, de qué ejercicio, qué decidió la persona
--    sobre los saldos de apertura, qué avisos salieron y qué nota
--    escribió. El archivo original va al bucket PRIVADO `planillas`,
--    mismo molde que los extractos (061) y los comprobantes (043): trae
--    nombres de contribuyentes y vale lo mismo que el libro.
--
--  · `treasury_entries.import_batch_id` ata cada asiento a su lote. Es lo
--    que hace que equivocarse sea barato: con cinco planillas viejas, de
--    formatos que nadie revisó en años, la primera importación de cada
--    año va a estar mal. Re-importar tiene que costar un click, no una
--    sesión de SQL.
--
--  · `undo_ledger_import()` borra el lote entero. Existe porque el guard
--    de la 054 no deja borrar un movimiento con recibo emitido —y los
--    aportes históricos vienen todos con el recibo ya emitido, que es la
--    verdad—. La excepción es angosta a propósito: solo borra lo que
--    trajo ESE lote, solo mientras ningún mes de esos movimientos esté
--    cerrado, y solo desde la función. El orden de trabajo es importar
--    los cinco años → auditar → corregir → recién ahí cerrar los meses.
--
-- ⚠️ Qué NO hace: la numeración de recibos sigue siendo única por
-- localidad, no por ejercicio. En Montevideo la serie es continua entre
-- años (el 183 arranca en el 281) y en la AEN también, así que los años
-- viejos rellenan números más bajos. Si alguna comunidad reiniciara la
-- serie cada año, el índice único la rechazaría: eso es otra migración.
-- El importador lo verifica ANTES de insertar y lo avisa con palabras.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. El lote ──────────────────────────────────────────────────

create table if not exists public.treasury_ledger_imports (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  -- El ejercicio al que se asignan TODOS los movimientos del archivo. Lo
  -- declara la persona: el corte no se deriva de la fecha (ver el
  -- comentario de `bahai_year` en la 040). Las filas cuya fecha cae en
  -- otro ejercicio se avisan y no se bloquean.
  bahai_year int not null,
  file_name text not null,
  -- <locality_id>/<bahai_year>/<uuid>.<ext> en el bucket `planillas`.
  storage_path text unique,
  entries_count int not null default 0,
  -- Qué se hizo con los "Saldo anterior" de la planilla:
  --   'importadas'  — el libro arranca acá, así que son asientos reales.
  --   'verificadas' — el ejercicio anterior ya está en el libro y el saldo
  --                   se arrastra solo; la apertura declarada se usó para
  --                   comparar y no entró como asiento.
  --   'sin_apertura'— la planilla no traía ninguna.
  openings_mode text not null default 'sin_apertura'
    check (openings_mode in ('importadas', 'verificadas', 'sin_apertura')),
  -- [{ account, currency, declared, computed, diff }] — la comparación
  -- entre lo que declaró la planilla y el cierre calculado del ejercicio
  -- anterior. Se guarda aunque cierre: es la prueba de que cerró.
  openings jsonb not null default '[]'::jsonb,
  -- Los avisos que se mostraron al confirmar. Ninguno bloquea, pero
  -- quedan: dentro de un año nadie se acuerda de qué se dejó pasar.
  warnings jsonb not null default '[]'::jsonb,
  -- Lo que la persona quiera dejar escrito sobre esta importación.
  note text,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists treasury_ledger_imports_year_idx
  on public.treasury_ledger_imports (locality_id, bahai_year, created_at desc);

drop trigger if exists set_locality_treasury_ledger_imports on public.treasury_ledger_imports;
create trigger set_locality_treasury_ledger_imports
  before insert on public.treasury_ledger_imports
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_ledger_imports enable row level security;

drop policy if exists "treasury_ledger_imports_tag_all" on public.treasury_ledger_imports;
create policy "treasury_ledger_imports_tag_all" on public.treasury_ledger_imports
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 2. El asiento sabe de qué lote vino ─────────────────────────

alter table public.treasury_entries
  add column if not exists import_batch_id uuid
    references public.treasury_ledger_imports(id) on delete cascade;

create index if not exists treasury_entries_import_batch_idx
  on public.treasury_entries (import_batch_id)
  where import_batch_id is not null;

-- ─── 3. El guard, con la excepción de deshacer ───────────────────
--
-- Igual que la 054, con un solo agregado en la rama DELETE: un asiento
-- que trajo una importación se puede borrar CON su importación, aunque
-- tenga el recibo emitido. La marca viaja en una GUC de transacción
-- (`set local`), así que la excepción no sobrevive a la función que la
-- puso y ningún otro camino de borrado la hereda. El chequeo de mes
-- cerrado queda ARRIBA y sigue valiendo: un mes cerrado no se deshace
-- ni deshaciendo la importación.

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
    -- Deshaciendo la importación que lo trajo: el movimiento nunca fue
    -- un acto de esta Tesorería, es un renglón de una planilla vieja mal
    -- leída. Ver undo_ledger_import().
    if old.import_batch_id is not null
       and coalesce(current_setting('app.undo_import', true), '') = old.import_batch_id::text then
      return old;
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

-- ─── 4. Deshacer una importación ─────────────────────────────────
--
-- Security definer porque tiene que poder poner la GUC y borrar asientos
-- con recibo emitido; el permiso se chequea adentro, con el mismo
-- criterio que la RLS de las tablas de Tesorería (tag + localidad del
-- sombrero puesto). Devuelve cuántos movimientos borró.

create or replace function public.undo_ledger_import(p_batch uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc uuid;
  v_closed int;
  v_deleted int;
begin
  select locality_id into v_loc
  from public.treasury_ledger_imports
  where id = p_batch;

  if v_loc is null then
    raise exception 'NO_EXISTE: esa importación ya no está.';
  end if;

  -- `is distinct from` y no `<>`: con una localidad nula, comparar daría
  -- NULL y el IF no dispararía (el mismo descuido que ya se pagó en
  -- treasury_progress(), ver CLAUDE.md).
  if not public.has_treasury_tag(auth.uid())
     or v_loc is distinct from public.current_locality_id() then
    raise exception 'SIN_PERMISO: la importación es de otra comunidad.';
  end if;

  -- Un mes cerrado congela lo que tiene adentro, venga de donde venga.
  select count(*) into v_closed
  from public.treasury_entries e
  where e.import_batch_id = p_batch
    and public.treasury_month_is_closed(e.locality_id, e.entry_date);

  if v_closed > 0 then
    raise exception 'MES_CERRADO: % de los movimientos de esta importación están en meses cerrados; reabrí el mes o corregilos con contra-asientos.',
      v_closed;
  end if;

  -- La marca que el guard reconoce. `set local`: muere con la
  -- transacción, así que ningún otro borrado la hereda.
  perform set_config('app.undo_import', p_batch::text, true);

  delete from public.treasury_entries where import_batch_id = p_batch;
  get diagnostics v_deleted = row_count;

  delete from public.treasury_ledger_imports where id = p_batch;

  return v_deleted;
end;
$$;

revoke all on function public.undo_ledger_import(uuid) from public;
grant execute on function public.undo_ledger_import(uuid) to authenticated;

-- ─── 5. Storage: la planilla original, en bucket PRIVADO ─────────

insert into storage.buckets (id, name, public)
values ('planillas', 'planillas', false)
on conflict (id) do update set public = false;

drop policy if exists "planillas_read" on storage.objects;
create policy "planillas_read" on storage.objects
  for select using (
    bucket_id = 'planillas'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "planillas_insert" on storage.objects;
create policy "planillas_insert" on storage.objects
  for insert with check (
    bucket_id = 'planillas'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "planillas_delete" on storage.objects;
create policy "planillas_delete" on storage.objects
  for delete using (
    bucket_id = 'planillas'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );
