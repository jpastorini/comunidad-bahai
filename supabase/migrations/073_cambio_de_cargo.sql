-- 073 · Cambios en la Asamblea a mitad de ejercicio: desde cuándo y hasta cuándo
--
-- La composición de la Asamblea (052) era una foto por ejercicio: nueve
-- posiciones, un cargo por persona, un solo Tesorero/a por ejercicio
-- (índice único). Y el nombre que firma el recibo (060) sale del
-- Tesorero/a del ejercicio que contiene la fecha del asiento.
--
-- Con eso, un cambio de tesorero en noviembre rompe los recibos de abril
-- a noviembre: al cargar al nuevo en la composición, cualquier recibo
-- viejo que se reimprima sale con SU nombre, que no es quien lo firmó.
-- Y lo mismo con la firma del balance o de la hoja interna.
--
-- La solución es darle vigencia a cada fila: `since` (desde cuándo ocupa
-- esa posición y ese cargo; NULL = desde la elección del ejercicio) y
-- `until` (hasta cuándo; NULL = sigue). Quien deja el cargo queda en la
-- tabla con su `until`; quien lo toma entra con su `since`. La
-- composición de un momento dado son las filas vigentes en esa fecha.
--
-- Los dos índices únicos pasan a acotar solo las filas VIGENTES (`until is
-- null`): un solo Tesorero/a en funciones, una sola persona por posición
-- en funciones. La historia puede tener varias.

alter table public.assembly_members
  add column if not exists since date,
  add column if not exists until date,
  add constraint assembly_members_vigencia_check
    check (until is null or since is null or until > since);

comment on column public.assembly_members.since is
  'Desde cuándo ocupa la posición y el cargo. NULL = desde la elección del ejercicio (assembly_terms.elected_on).';
comment on column public.assembly_members.until is
  'Hasta cuándo la ocupó (exclusivo). NULL = sigue en funciones.';

-- El unique (term_id, position) del create table: se reemplaza por uno
-- parcial sobre las filas vigentes.
alter table public.assembly_members
  drop constraint if exists assembly_members_term_id_position_key;

drop index if exists public.assembly_members_position_current_uniq;
create unique index assembly_members_position_current_uniq
  on public.assembly_members (term_id, position)
  where until is null;

drop index if exists public.assembly_members_office_uniq;
create unique index assembly_members_office_uniq
  on public.assembly_members (term_id, office)
  where office is not null and until is null;

-- ─── El nombre que firma, por vigencia ────────────────────────────
-- Misma precedencia que la 060 (override → composición → quien emitió →
-- el tag), con la composición leída por vigencia: el Tesorero/a cuyo
-- tramo contiene la fecha del asiento. Sin fecha, el que está en funciones
-- del ejercicio más reciente.

create or replace function public.receipt_signer_name(
  p_locality uuid,
  p_date date default null,
  p_issued_by uuid default null
)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(s.treasurer_name), '')
       from public.treasury_receipt_settings s
      where s.locality_id = p_locality),

    (select m.display_name
       from public.assembly_members m
       join public.assembly_terms t on t.id = m.term_id
      where m.locality_id = p_locality
        and m.office = 'tesorero'
        and p_date is not null
        and coalesce(m.since, t.elected_on) is not null
        and coalesce(m.since, t.elected_on) <= p_date
        and (m.until is null or m.until > p_date)
      order by coalesce(m.since, t.elected_on) desc
      limit 1),

    (select m.display_name
       from public.assembly_members m
       join public.assembly_terms t on t.id = m.term_id
      where m.locality_id = p_locality
        and m.office = 'tesorero'
        and m.until is null
      order by t.bahai_year desc, m.since desc nulls last
      limit 1),

    (select p.full_name
       from public.profiles p
      where p.id = p_issued_by),

    (select p.full_name
       from public.profile_localities ml
       join public.profiles p on p.id = ml.profile_id
      where ml.locality_id = p_locality
        and ml.can_manage_treasury
        and p.disabled_at is null
      order by (ml.role = 'admin') desc, p.created_at
      limit 1)
  );
$$;

revoke all on function public.receipt_signer_name(uuid, date, uuid) from public, anon;
grant execute on function public.receipt_signer_name(uuid, date, uuid) to authenticated;
