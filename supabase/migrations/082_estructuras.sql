-- ═════════════════════════════════════════════════════════════════
-- 082 · Estructuras: Comités, Departamentos, Coordinación y Junta de
-- Instituto (Etapa 1: el modelo y el aislamiento).
--
-- Decidido con el usuario el 2026-10-24. Una estructura es una
-- institución que crea una Asamblea —la Nacional o una Local— para un
-- trabajo administrativo: se reúne, lleva actas y tareas, tiene
-- calendario y Tesorería, y le presenta informes a la Asamblea que la
-- creó. No tiene creyentes: no publica comunicados, no celebra Fiestas,
-- no aparece en ninguna lista donde alguien elige su comunidad.
--
-- Mismo camino que la Comunidad Nacional (056): una estructura es UNA
-- FILA MÁS en `localities`, con `kind = 'estructura'` y `parent_id`
-- apuntando a la Asamblea que la creó. Así hereda sin construir nada el
-- libro, los recibos, los cierres, las tareas, el calendario y la grilla
-- de reuniones, que ya son por localidad. Sus integrantes tienen una
-- membresía (055) con rol de Asamblea, y el tag de Tesorería para quien
-- la lleve.
--
-- Lo que hace esta migración:
--   1. `kind = 'estructura'`, `parent_id`, `structure_type`, y el
--      nombre único dentro de cada Asamblea (antes, en todo el país).
--   2. El sombrero (055) nunca se pone SOLO en una estructura: ni al
--      sumarse a una, ni cuando se borra la membresía que estaba puesta.
--      Ponérselo es un acto explícito, desde el panel.
--   3. `return_to_community()`: la app del creyente vuelve sola a la
--      comunidad de la persona si quedó con una estructura puesta.
--   4. `join_locality()` y `move_membership()` no tocan estructuras.
--   5. La grilla de disponibilidad pasa a ser DE LA PERSONA, no del
--      sombrero con que la cargó.
--
-- Quién crea estructuras y nombra integrantes lo decide el server
-- action (`app/admin/(panel)/estructuras/actions.ts`), con service-role
-- y después de comprobar que quien pide es admin de la Asamblea madre:
-- la RLS de `profile_localities` solo deja tocar filas de la localidad
-- PUESTA, y la Asamblea madre nunca tiene puesta a su estructura.
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. El modelo ────────────────────────────────────────────────

alter table public.localities
  add column if not exists parent_id uuid references public.localities(id) on delete restrict,
  add column if not exists structure_type text;

alter table public.localities drop constraint if exists localities_kind_check;
alter table public.localities add constraint localities_kind_check
  check (kind in ('ael', 'nacional', 'estructura'));

-- Una estructura siempre cuelga de una Asamblea y declara su tipo; una
-- Asamblea nunca cuelga de nada. Los cuatro tipos se comportan igual
-- (decisión del usuario): el tipo es una etiqueta.
alter table public.localities drop constraint if exists localities_structure_shape;
alter table public.localities add constraint localities_structure_shape check (
  (kind = 'estructura') = (parent_id is not null)
  and (kind <> 'estructura'
       or structure_type in ('comite', 'departamento', 'coordinacion_instituto', 'junta_instituto'))
);

create index if not exists localities_parent_idx
  on public.localities (parent_id) where parent_id is not null;

-- La madre es una Asamblea, nunca otra estructura: no hay comités de
-- comités. Va por trigger porque un check no puede mirar otra fila.
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
  return new;
end;
$$;

drop trigger if exists localities_parent_guard on public.localities;
create trigger localities_parent_guard
  before insert or update of parent_id on public.localities
  for each row execute function public.localities_parent_guard();

-- El nombre era único en todo el país (012), y dos Asambleas no podrían
-- tener cada una su "Comité de Juventud". Las Asambleas siguen únicas
-- entre sí; una estructura, dentro de su Asamblea.
drop index if exists public.localities_name_unique;
create unique index if not exists localities_name_unique
  on public.localities (lower(name)) where parent_id is null;
create unique index if not exists localities_structure_name_unique
  on public.localities (parent_id, lower(name)) where parent_id is not null;

-- ─── 2. El sombrero no cae solo en una estructura ────────────────
-- Misma función de la 055 con dos cambios:
--   INSERT → sumarse a una estructura no le pone el sombrero a quien no
--            tenía ninguno: una estructura no es una comunidad.
--   DELETE → si se borra la membresía puesta, se prefiere una comunidad
--            (AEL o Nacional) a una estructura. Antes elegía la más
--            vieja, y podía dejar a alguien con un comité puesto en toda
--            la app sin que lo pidiera.
create or replace function public.profile_localities_sync()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_active uuid;
  v_next   uuid;
begin
  if tg_op = 'DELETE' then
    select locality_id into v_active from public.profiles where id = old.profile_id;
    if v_active is not distinct from old.locality_id then
      select m.locality_id into v_next
      from public.profile_localities m
      join public.localities l on l.id = m.locality_id
      where m.profile_id = old.profile_id
      order by (l.kind = 'estructura'), m.created_at
      limit 1;
      perform public.apply_membership(old.profile_id, v_next);
    end if;
    return old;
  end if;

  select locality_id into v_active from public.profiles where id = new.profile_id;
  if v_active = new.locality_id
     or (v_active is null and not exists (
           select 1 from public.localities
           where id = new.locality_id and kind = 'estructura'
         ))
  then
    perform public.apply_membership(new.profile_id, new.locality_id);
  end if;
  return new;
end;
$$;

-- ─── 3. Volver a la comunidad ────────────────────────────────────
-- El sombrero es uno solo y vale para toda la app. Con una estructura
-- puesta, el Inicio, los Comunicados y la Tesorería del creyente le
-- apuntarían al comité. Ponérsela es para el panel; al entrar a la app
-- del creyente, `requireMember` manda a /comunidad/volver, que llama a
-- esta función.
--
-- Elige la Asamblea madre de la estructura puesta si la persona es de
-- ella; si no, su comunidad más vieja. Devuelve la elegida, o NULL si la
-- persona no pertenece a ninguna comunidad (solo a estructuras): en ese
-- caso el sombrero queda donde estaba y la app la manda al panel.
create or replace function public.return_to_community()
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_active uuid;
  v_kind   text;
  v_parent uuid;
  v_next   uuid;
begin
  if v_uid is null then
    raise exception 'SIN_SESION: hay que estar autenticado';
  end if;

  select p.locality_id, l.kind, l.parent_id
    into v_active, v_kind, v_parent
  from public.profiles p
  left join public.localities l on l.id = p.locality_id
  where p.id = v_uid;

  if v_kind is distinct from 'estructura' then
    return v_active;
  end if;

  select m.locality_id into v_next
  from public.profile_localities m
  join public.localities l on l.id = m.locality_id
  where m.profile_id = v_uid and l.kind <> 'estructura'
  order by (m.locality_id = v_parent) desc, m.created_at
  limit 1;

  if v_next is not null then
    perform public.apply_membership(v_uid, v_next);
  end if;
  return v_next;
end;
$$;

revoke all on function public.return_to_community() from public;
grant execute on function public.return_to_community() to authenticated;

-- ─── 4. Primer ingreso y mudanza no tocan estructuras ────────────

create or replace function public.join_locality(p_locality_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'SIN_SESION: hay que estar autenticado';
  end if;

  if exists (select 1 from public.profile_localities where profile_id = v_uid) then
    raise exception 'YA_TIENE_COMUNIDAD: usá switch_locality o pedí el cambio a la Asamblea';
  end if;

  if not exists (
    select 1 from public.localities
    where id = p_locality_id and is_active and kind <> 'estructura'
  ) then
    raise exception 'LOCALIDAD_INVALIDA: esa comunidad no existe o está inactiva';
  end if;

  insert into public.profile_localities (profile_id, locality_id)
  values (v_uid, p_locality_id)
  on conflict do nothing;
end;
$$;

-- La mudanza (029) saca la membresía de la comunidad de ORIGEN, que es
-- el sombrero que la persona tenía puesto al pedirla. Si ese sombrero
-- era una estructura, borraba la estructura y le dejaba la AEL vieja.
-- Ahora una estructura nunca es origen ni destino de una mudanza.
create or replace function public.move_membership(
  p_profile uuid,
  p_from_locality uuid,
  p_to_locality uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin(auth.uid())
    and public.current_locality_id() = p_to_locality
  ) and not public.is_national_admin(auth.uid()) then
    raise exception 'SIN_PERMISO: solo la Asamblea de la comunidad destino puede mudar a alguien';
  end if;

  if exists (
    select 1 from public.localities where id = p_to_locality and kind = 'estructura'
  ) then
    raise exception 'DESTINO_INVALIDO: no se puede mudar a alguien a una estructura';
  end if;

  insert into public.profile_localities (profile_id, locality_id)
  values (p_profile, p_to_locality)
  on conflict (profile_id, locality_id) do nothing;

  if p_from_locality is not null
     and p_from_locality <> p_to_locality
     and not exists (
       select 1 from public.localities where id = p_from_locality and kind = 'estructura'
     )
  then
    delete from public.profile_localities
    where profile_id = p_profile and locality_id = p_from_locality;
  end if;

  perform public.apply_membership(p_profile, p_to_locality);
end;
$$;

-- ─── 5. La disponibilidad es de la persona ───────────────────────
-- La grilla (033) es una por persona —el índice único es (persona, día,
-- hora), sin localidad— pero las policies la ataban al sombrero con que
-- se cargó. Quien estaba en su AEL y en la AEN no podía cargarla desde
-- la segunda: el DELETE no veía la celda de la otra localidad y el
-- INSERT chocaba con el índice. Con las estructuras eso le pasaría a
-- cada integrante.
--
-- Ahora cada uno escribe SUS celdas con cualquier sombrero, y una
-- Asamblea o estructura ve la grilla de quienes tienen rol en ella (la
-- misma persona aparece en el consolidado de todas sus instituciones).
-- `locality_id` queda como dato histórico y nadie filtra por él.

drop policy if exists "availability_select" on public.availability_slots;
create policy "availability_select" on public.availability_slots
  for select using (
    user_id = auth.uid()
    or (
      public.is_admin(auth.uid())
      and exists (
        select 1 from public.profile_localities m
        where m.profile_id = availability_slots.user_id
          and m.locality_id = public.current_locality_id()
          and m.role = 'admin'
      )
    )
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "availability_write" on public.availability_slots;
create policy "availability_write" on public.availability_slots
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
--   -- Las estructuras y su madre:
--   select s.name, s.structure_type, p.name as asamblea
--   from public.localities s join public.localities p on p.id = s.parent_id
--   where s.kind = 'estructura';
--
--   -- Nadie quedó con una estructura puesta sin pedirlo:
--   select p.full_name, l.name from public.profiles p
--   join public.localities l on l.id = p.locality_id
--   where l.kind = 'estructura';
-- ═════════════════════════════════════════════════════════════════
