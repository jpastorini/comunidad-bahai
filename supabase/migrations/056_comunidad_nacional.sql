-- ═════════════════════════════════════════════════════════════════
-- 056 · La Comunidad Nacional: un tenant más, no un caso especial.
--
-- Segundo paso del Usuario Nacional (el primero fue la 055). La idea
-- que ordena todo, decidida con el usuario el 2026-09-16: hay DOS
-- "nacional" distintos y el error caro es confundirlos.
--
--   · Lo que la AEN hace PARA TODO EL PAÍS (comunicados nacionales,
--     materiales, mensajes de la Casa Universal) va con
--     `locality_id IS NULL`, que desde la 021 significa "lo ven todas
--     las localidades". Un comunicado nacional no es del tenant
--     nacional: es de nadie y de todos.
--   · Lo que la AEN hace PARA SÍ MISMA (su tesorería, su chat, su
--     ficha legal, sus creyentes) vive en su PROPIO tenant: una fila
--     más en `localities`.
--
-- Por eso acá no se crea casi nada. La Comunidad Nacional hereda el
-- libro contable, los recibos, los informes, los cierres, el balance,
-- el chat por canal, la ficha legal, el link de invitación y la
-- aprobación de altas, porque todo eso ya es por localidad.
--
-- ⚠️ `is_national_admin` NO es la Asamblea Nacional. Ese flag aparece
-- en las policies de `treasury_entries`, `treasury_contributors` y los
-- informes: quien lo tiene lee el libro y los nombres de
-- contribuyentes de TODAS las localidades. Dárselo a la Secretaría o a
-- la Tesorería nacional para que puedan publicar sería regalarles los
-- aportes nominados de cada comunidad del país. Queda como superadmin
-- del sistema; la AEN va con `is_national_assembly()`, que autoriza a
-- ESCRIBIR contenido nacional y nada más.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. Qué clase de comunidad es ─────────────────────────────────

alter table public.localities
  add column if not exists kind text not null default 'ael';

alter table public.localities drop constraint if exists localities_kind_check;
alter table public.localities add constraint localities_kind_check
  check (kind in ('ael', 'nacional'));

comment on column public.localities.kind is
  'ael = Asamblea Espiritual Local. nacional = la Comunidad Nacional, el tenant de la AEN: sin Fiesta de 19 Días, con todo lo demás.';

-- Una sola Comunidad Nacional. Es un índice y no una constraint porque
-- tiene que ser parcial: hay muchas `ael` y una sola `nacional`.
create unique index if not exists localities_una_nacional
  on public.localities ((kind)) where kind = 'nacional';

-- ─── 2. La fila ───────────────────────────────────────────────────
-- Se siembra acá y no se pide que la creen a mano (misma convención
-- que las 19 Fiestas y los 11 Días Sagrados): existe por definición.

insert into public.localities (name, city, country, description, kind)
select 'Comunidad Bahá''í del Uruguay', null, 'Uruguay',
       'La comunidad nacional: para quienes sirven a nivel del país o no pertenecen a una Asamblea Espiritual Local.',
       'nacional'
where not exists (select 1 from public.localities where kind = 'nacional');

-- La ficha legal (052) arranca con el nombre registrado. No es un
-- detalle cosmético: el recibo, el Libro de Caja, la hoja interna, el
-- deck y el balance imprimen `registered_name` y, cuando está vacío,
-- caen a "Asamblea Espiritual LOCAL de los Bahá'ís de <localidad>".
-- Con esto los documentos de la AEN salen bien desde el primero. El
-- RUT, el BPS y el domicilio fiscal los carga la propia AEN.
insert into public.assembly_records (locality_id, registered_name)
select l.id, 'Asamblea Espiritual Nacional de los Bahá''ís del Uruguay'
from public.localities l
where l.kind = 'nacional'
on conflict (locality_id) do nothing;

-- ─── 3. El helper de la Asamblea Nacional ─────────────────────────
-- Mismo molde que is_admin(): mira el SOMBRERO puesto (055). O sea que
-- alguien que es de la AEN y además de su AEL escribe contenido
-- nacional solo mientras tenga puesto el sombrero nacional, que es
-- exactamente lo que se quiere: se publica en nombre de la institución
-- con la que estás actuando en ese momento.

create or replace function public.is_national_assembly(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.localities l on l.id = p.locality_id
    where p.id = uid
      and p.role = 'admin'
      and l.kind = 'nacional'
  );
$$;

-- ─── 4. La AEN puede escribir contenido nacional ──────────────────
-- Copia de las policies de la 021 más la línea de la AEN. El alcance
-- es el mismo que ya tenía el admin nacional: SOLO filas con
-- locality_id IS NULL. Nada de esto le da acceso a ninguna localidad.

drop policy if exists "messages_admin_write" on public.messages;
create policy "messages_admin_write" on public.messages
  for all
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
    or (public.is_national_assembly(auth.uid()) and locality_id is null)
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
    or (public.is_national_assembly(auth.uid()) and locality_id is null)
  );

drop policy if exists "study_materials_admin_write" on public.study_materials;
create policy "study_materials_admin_write" on public.study_materials
  for all
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
    or (public.is_national_assembly(auth.uid()) and locality_id is null)
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
    or (public.is_national_assembly(auth.uid()) and locality_id is null)
  );

-- ─── 5. El padrón de una comunidad ────────────────────────────────
-- ⚠️ La razón de esta función es la distinción que destapó el usuario
-- el 2026-09-16 (ver CLAUDE.md): el sombrero dice qué VE una persona;
-- la membresía dice a quién PERTENECE. Con una sola membresía las dos
-- preguntas dan lo mismo y nadie lo nota; con dos sombreros, quien ande
-- con el otro puesto desaparece del padrón de la primera —y deja de
-- recibir su push, que falla en silencio—.
--
-- Devuelve a las personas de una comunidad SEGÚN SU MEMBRESÍA, con el
-- rol y los tags DE ESA COMUNIDAD (no los del sombrero). Security
-- invoker a propósito: la RLS de `profile_localities` ya acota a la
-- Asamblea de esa localidad, y el push la llama con service-role.

create or replace function public.locality_members(p_locality_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  is_bahai boolean,
  disabled_at timestamptz,
  last_seen_at timestamptz,
  pwa_installed_at timestamptz,
  created_at timestamptz,
  role text,
  can_respond_chat boolean,
  can_manage_treasury boolean,
  can_manage_bulletin boolean
)
language sql stable
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.avatar_url, p.is_bahai,
         p.disabled_at, p.last_seen_at, p.pwa_installed_at, p.created_at,
         m.role, m.can_respond_chat, m.can_manage_treasury,
         m.can_manage_bulletin
  from public.profile_localities m
  join public.profiles p on p.id = m.profile_id
  where m.locality_id = p_locality_id
  order by p.full_name nulls last;
$$;

grant execute on function public.locality_members(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════
-- Verificación (opcional, para correr en el SQL Editor).
--
--   -- La Comunidad Nacional existe y es una sola:
--   select id, name, kind from public.localities where kind = 'nacional';
--
--   -- El padrón de una localidad y el "sombrero puesto" coinciden
--   -- mientras nadie tenga dos membresías. Cuando el usuario se sume a
--   -- la Nacional, la segunda va a devolver MENOS filas que la primera:
--   -- esa diferencia es exactamente el bug que la función evita.
--   select count(*) from public.locality_members('<UUID-LOCALIDAD>');
--   select count(*) from public.profiles where locality_id = '<UUID-LOCALIDAD>';
-- ═════════════════════════════════════════════════════════════════
