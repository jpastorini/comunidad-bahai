-- 075 · Contribuyentes: fusionar dos fichas de la misma persona
--
-- El padrón de contribuyentes (040) se llenó de tres maneras que no se
-- hablan: los importados de la planilla (sueltos, sin perfil), los
-- creados al elegir un creyente en el buscador (vinculados), y los
-- escritos a mano. Resultado: "Carlos Cardona" y "Sr. Carlos Cardona"
-- como dos fichas, con los aportes partidos —en «Mis aportes» ve la
-- mitad y en Compromisos sale como "no se puede saber"—.
--
-- Fusionar es mover TODOS los asientos de la ficha que sobra a la que
-- queda y borrar la que sobra. El problema es el guardián de la 054: un
-- asiento de un mes cerrado no admite UPDATE, y un aporte con recibo
-- emitido tampoco. Y es correcto que no lo admita en general —cambiar el
-- contribuyente de un asiento cerrado es reescribir el libro—, salvo en
-- este caso preciso: no cambia el hecho contable (misma fecha, monto,
-- cuenta, fondo, recibo), solo a qué FICHA del padrón apunta, y las dos
-- fichas son la misma persona. El recibo impreso sigue diciendo el
-- mismo nombre.
--
-- Mismo molde que undo_ledger_import() (062): una función security
-- definer pone una GUC de transacción con la ficha origen, y el guardián
-- deja pasar SOLO el cambio de `contributor_id` desde esa ficha. Todo lo
-- demás sigue congelado.

-- ─── 1. El guardián, con la excepción acotada ─────────────────────

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
  merging boolean := false;
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
    -- Deshaciendo la importación que lo trajo (062).
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

  -- Fusión de contribuyentes (075): solo `contributor_id`, solo desde la
  -- ficha nombrada en la GUC de la transacción, y nada más cambiado.
  merging :=
    old.contributor_id is not null
    and coalesce(current_setting('app.merge_contributor', true), '') = old.contributor_id::text
    and changed <@ (always_ok || array['contributor_id']);
  if merging then
    return new;
  end if;

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

-- ─── 2. Fusionar ──────────────────────────────────────────────────
-- Mueve los asientos de `p_source` a `p_target`, hereda el perfil si la
-- que queda no tenía, y borra la ficha que sobra. Permiso: tag de
-- Tesorería y las dos fichas de la localidad del sombrero puesto.
-- Devuelve cuántos asientos movió.

create or replace function public.merge_contributors(p_source uuid, p_target uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc uuid := public.current_locality_id();
  v_src public.treasury_contributors%rowtype;
  v_tgt public.treasury_contributors%rowtype;
  v_moved int;
begin
  if not public.has_treasury_tag(auth.uid()) then
    raise exception 'SIN_PERMISO: solo el tesorero puede fusionar contribuyentes.';
  end if;
  if p_source = p_target then
    raise exception 'FUSION_INVALIDA: son la misma ficha.';
  end if;
  select * into v_src from public.treasury_contributors where id = p_source and locality_id = v_loc;
  select * into v_tgt from public.treasury_contributors where id = p_target and locality_id = v_loc;
  if v_src.id is null or v_tgt.id is null then
    raise exception 'FUSION_INVALIDA: alguna de las fichas no es de esta comunidad.';
  end if;
  if v_src.profile_id is not null and v_tgt.profile_id is not null
     and v_src.profile_id <> v_tgt.profile_id then
    raise exception 'FUSION_INVALIDA: las dos fichas apuntan a creyentes distintos; desvinculá una antes.';
  end if;

  perform set_config('app.merge_contributor', p_source::text, true);

  update public.treasury_entries
     set contributor_id = p_target
   where contributor_id = p_source;
  get diagnostics v_moved = row_count;

  if v_tgt.profile_id is null and v_src.profile_id is not null then
    update public.treasury_contributors set profile_id = v_src.profile_id where id = p_target;
  end if;
  if v_tgt.notes is null and v_src.notes is not null then
    update public.treasury_contributors set notes = v_src.notes where id = p_target;
  end if;

  delete from public.treasury_contributors where id = p_source;
  return v_moved;
end;
$$;

revoke all on function public.merge_contributors(uuid, uuid) from public, anon;
grant execute on function public.merge_contributors(uuid, uuid) to authenticated;

comment on function public.merge_contributors(uuid, uuid) is
  'Fusiona dos fichas de contribuyente: mueve los asientos (también los de meses cerrados: no cambia el hecho contable) y borra la que sobra.';
