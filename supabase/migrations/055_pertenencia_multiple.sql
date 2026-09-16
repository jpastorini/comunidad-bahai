-- ═════════════════════════════════════════════════════════════════
-- 055 · Pertenencia múltiple: una persona en más de una comunidad.
--
-- Hasta hoy la pertenencia era UNA COLUMNA (`profiles.locality_id`) y
-- eso alcanzaba: cada creyente está en su Asamblea Local y nada más.
-- Con la Comunidad Nacional deja de alcanzar: el tesorero nacional es
-- creyente de Montevideo Y atiende la Tesorería nacional, y sus
-- permisos no son los mismos en las dos (tiene el tag de Tesorería en
-- lo nacional y no en su AEL).
--
-- ─────────────────────────────────────────────────────────────────
-- LA IDEA: `profile_localities` es la verdad; `profiles` es el
-- SOMBRERO que la persona tiene puesto ahora.
-- ─────────────────────────────────────────────────────────────────
--
-- La tabla nueva guarda una fila por comunidad a la que la persona
-- pertenece, con su rol y sus tags ahí adentro. `profiles.locality_id`,
-- `role` y los tres `can_*` pasan a ser una COPIA de la fila activa,
-- que la base mantiene sincronizada (trigger) y que la persona cambia
-- con `switch_locality()`.
--
-- El motivo de hacerlo así y no con `locality_id in (select ...)` en
-- cada policy: hay 152 policies que comparan contra
-- `current_locality_id()`, más `is_admin()`, `has_chat_tag()` y
-- `has_treasury_tag()` (supabase/schema.sql), más el `x-profile` que el
-- middleware inyecta en cada request. Todo eso describe UN sombrero y
-- sigue funcionando sin tocar una línea. Cambiar de comunidad es un
-- UPDATE de cinco columnas, no un cambio de modelo de datos.
--
-- Qué NO es por comunidad y se queda en `profiles`:
--   · is_bahai          — es una condición de la persona (047)
--   · is_national_admin — superadmin del SISTEMA (lee todos los libros
--                         contables); NO es "la Asamblea Nacional", que
--                         llega en la 056 con helper propio
--   · disabled_at       — el corte de acceso es de la persona
--
-- ⚠️ Sin las pantallas de la 056 esto no se ve: quien tiene una sola
-- membresía (o sea, todo el mundo hoy) no nota ninguna diferencia.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La tabla ──────────────────────────────────────────────────

create table if not exists public.profile_localities (
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  locality_id         uuid not null references public.localities(id) on delete cascade,
  role                text not null default 'member' check (role in ('member', 'admin')),
  can_respond_chat    boolean not null default false,
  can_manage_treasury boolean not null default false,
  can_manage_bulletin boolean not null default false,
  created_at          timestamptz not null default now(),
  primary key (profile_id, locality_id)
);

comment on table public.profile_localities is
  'Comunidades a las que pertenece cada persona, con su rol y tags EN CADA UNA. Es la fuente de verdad; profiles.locality_id/role/can_* son la copia de la fila activa (el "sombrero puesto"), que mantiene el trigger profile_localities_sync.';

create index if not exists profile_localities_locality_idx
  on public.profile_localities (locality_id);

-- Un Amigo/a de la Fe no tiene cargos en NINGUNA comunidad. Mismo
-- criterio que la constraint `profiles_amigo_sin_cargos` (047), pero
-- `is_bahai` vive en otra tabla, así que va por trigger. Definer para
-- que SIEMPRE vea la condición: si quien escribe no pudiera leer ese
-- perfil, el coalesce lo daría por creyente y el chequeo se saltearía
-- en silencio.
create or replace function public.profile_localities_check_amigo()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if (new.role = 'admin'
      or new.can_respond_chat
      or new.can_manage_treasury
      or new.can_manage_bulletin)
     and not coalesce(
       (select p.is_bahai from public.profiles p where p.id = new.profile_id),
       true
     )
  then
    raise exception 'AMIGO_SIN_CARGOS: un Amigo/a de la Fe no puede tener rol de Asamblea ni tags';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_localities_amigo on public.profile_localities;
create trigger profile_localities_amigo
  before insert or update on public.profile_localities
  for each row execute function public.profile_localities_check_amigo();

-- ─── 2. Backfill: lo que hay hoy, una fila por persona ────────────
-- Cada perfil con localidad entra con el rol y los tags que ya tiene.

insert into public.profile_localities (
  profile_id, locality_id, role,
  can_respond_chat, can_manage_treasury, can_manage_bulletin
)
select p.id, p.locality_id, p.role,
       p.can_respond_chat, p.can_manage_treasury, p.can_manage_bulletin
from public.profiles p
where p.locality_id is not null
on conflict (profile_id, locality_id) do nothing;

-- ─── 3. El sombrero: copiar la membresía a `profiles` ─────────────
-- Una sola función escribe las cinco columnas. Todo lo que cambia de
-- sombrero pasa por acá, que es lo que impide que la membresía y el
-- perfil queden diciendo cosas distintas.

create or replace function public.apply_membership(
  p_profile uuid,
  p_locality uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_locality is null then
    update public.profiles
    set locality_id = null,
        role = 'member',
        can_respond_chat = false,
        can_manage_treasury = false,
        can_manage_bulletin = false
    where id = p_profile;
    return;
  end if;

  update public.profiles p
  set locality_id = m.locality_id,
      role = m.role,
      can_respond_chat = m.can_respond_chat,
      can_manage_treasury = m.can_manage_treasury,
      can_manage_bulletin = m.can_manage_bulletin
  from public.profile_localities m
  where p.id = p_profile
    and m.profile_id = p_profile
    and m.locality_id = p_locality;
end;
$$;

revoke all on function public.apply_membership(uuid, uuid) from public;

-- El trigger que evita la deriva. Tres casos:
--   INSERT  → si la persona no tenía sombrero (primer ingreso, o la
--             invitación la sumó), se lo ponemos.
--   UPDATE  → si la fila tocada ES la del sombrero puesto (la Asamblea
--             le cambió el rol o un tag), se refleja al instante.
--   DELETE  → si se fue de la comunidad que tenía puesta, pasa a
--             cualquier otra que le quede; si no le queda ninguna,
--             vuelve al estado "todavía no eligió".
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
      select locality_id into v_next
      from public.profile_localities
      where profile_id = old.profile_id
      order by created_at
      limit 1;
      perform public.apply_membership(old.profile_id, v_next);
    end if;
    return old;
  end if;

  select locality_id into v_active from public.profiles where id = new.profile_id;
  if v_active is null or v_active = new.locality_id then
    perform public.apply_membership(new.profile_id, new.locality_id);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_localities_sync on public.profile_localities;
create trigger profile_localities_sync
  after insert or update or delete on public.profile_localities
  for each row execute function public.profile_localities_sync();

-- ─── 4. Cambiar de sombrero ───────────────────────────────────────
-- Security definer porque `profiles_update_self` (039) congela
-- `locality_id`, `role` y los tags para el propio usuario, y está bien
-- que los congele: sin eso, un PATCH por PostgREST a la propia fila
-- sería una escalada de privilegios. La función es la única puerta, y
-- solo abre hacia una comunidad donde la persona YA tiene membresía.

create or replace function public.switch_locality(p_locality_id uuid)
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

  if not exists (
    select 1 from public.profile_localities
    where profile_id = v_uid and locality_id = p_locality_id
  ) then
    raise exception 'SIN_MEMBRESIA: no pertenecés a esa comunidad';
  end if;

  perform public.apply_membership(v_uid, p_locality_id);
end;
$$;

revoke all on function public.switch_locality(uuid) from public;
grant execute on function public.switch_locality(uuid) to authenticated;

-- Primer ingreso: la persona elige su comunidad y queda adentro.
-- Solo vale cuando NO tiene ninguna membresía todavía, que es
-- exactamente lo que hoy permite la excepción de `locality_id is null`
-- en la policy de la 039. Sumar una SEGUNDA comunidad no pasa por acá:
-- va por invitación (037) o la aprueba la Asamblea destino (029).
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
    select 1 from public.localities where id = p_locality_id and is_active
  ) then
    raise exception 'LOCALIDAD_INVALIDA: esa comunidad no existe o está inactiva';
  end if;

  insert into public.profile_localities (profile_id, locality_id)
  values (v_uid, p_locality_id)
  on conflict do nothing;
  -- El sombrero lo pone el trigger de sincronización.
end;
$$;

revoke all on function public.join_locality(uuid) from public;
grant execute on function public.join_locality(uuid) to authenticated;

-- ─── 5. RLS ───────────────────────────────────────────────────────
-- Cada persona ve sus propias membresías (las necesita el selector de
-- comunidad). La Asamblea ve y escribe las de SU localidad, que es la
-- que administra; no las de otra, ni siquiera para mirar quién más
-- pertenece ahí. El admin nacional, todas.

alter table public.profile_localities enable row level security;

drop policy if exists "profile_localities_select" on public.profile_localities;
create policy "profile_localities_select" on public.profile_localities
  for select using (
    profile_id = auth.uid()
    or (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "profile_localities_admin_write" on public.profile_localities;
create policy "profile_localities_admin_write" on public.profile_localities
  for all
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- Mudanza aprobada por la Asamblea destino (029). No puede ser un
-- INSERT + DELETE desde el panel: la RLS de arriba solo deja tocar
-- filas de la PROPIA localidad, así que la Asamblea destino nunca
-- podría borrar la membresía de la comunidad de origen. La autoridad
-- que exige la función es la misma que ya tenía el panel (admin de la
-- localidad destino), y la mudanza saca SOLO la comunidad de origen:
-- si la persona además pertenece a la Nacional, ahí se queda.
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

  insert into public.profile_localities (profile_id, locality_id)
  values (p_profile, p_to_locality)
  on conflict (profile_id, locality_id) do nothing;

  if p_from_locality is not null and p_from_locality <> p_to_locality then
    delete from public.profile_localities
    where profile_id = p_profile and locality_id = p_from_locality;
  end if;

  -- El sombrero queda en la comunidad destino, que es a donde se mudó.
  perform public.apply_membership(p_profile, p_to_locality);
end;
$$;

revoke all on function public.move_membership(uuid, uuid, uuid) from public;
grant execute on function public.move_membership(uuid, uuid, uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
--   -- Toda persona con localidad tiene su membresía, y el sombrero
--   -- coincide con ella. Las dos consultas deben devolver 0 filas:
--   select p.id from public.profiles p
--   where p.locality_id is not null
--     and not exists (
--       select 1 from public.profile_localities m
--       where m.profile_id = p.id and m.locality_id = p.locality_id
--     );
--
--   select p.id from public.profiles p
--   join public.profile_localities m
--     on m.profile_id = p.id and m.locality_id = p.locality_id
--   where p.role is distinct from m.role
--      or p.can_respond_chat is distinct from m.can_respond_chat
--      or p.can_manage_treasury is distinct from m.can_manage_treasury
--      or p.can_manage_bulletin is distinct from m.can_manage_bulletin;
--
--   -- Cambiar a una comunidad donde no se pertenece debe fallar con
--   -- SIN_MEMBRESIA:
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UUID>","role":"authenticated"}';
--   select public.switch_locality('<UUID-DE-OTRA-LOCALIDAD>');
--   rollback;
-- ═════════════════════════════════════════════════════════════════
