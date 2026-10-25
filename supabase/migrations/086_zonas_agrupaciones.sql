-- ═════════════════════════════════════════════════════════════════
-- 086 · El mapa del país: zonas electorales y agrupaciones.
--
-- Decidido con el usuario el 2026-10-25. País → 3 zonas electorales →
-- 20 agrupaciones, que son los 19 departamentos con Canelones partido en
-- Este y Oeste. Sin localidades: son muchas y no hacen falta.
--
-- Zonas y agrupaciones son TERRITORIO, no instituciones: no tienen
-- integrantes, ni libro, ni panel. No son filas de `localities`; son
-- etiquetas con jerarquía, y lo que las usa (las estructuras de
-- agrupación, el padrón de la Asamblea Nacional, algún día la Convención)
-- pregunta en qué agrupación está una Asamblea o una persona.
--
--   · Una Asamblea Local está en una agrupación (`localities.agrupacion_id`).
--     La migración ubica las que puede por el nombre; el resto, y las de
--     Canelones, las asigna la Asamblea Nacional.
--   · Una persona: la de su Asamblea Local si tiene una; si no —la
--     mayoría del país, que pertenece a la Comunidad Nacional—, la que
--     ella eligió (`profiles.agrupacion_id`), que es OPCIONAL.
--   · La zona sale de la agrupación. Qué agrupación va en cada zona lo
--     asigna a mano la Asamblea Nacional (Admin Nacional → Zonas y
--     agrupaciones).
--
-- Solo vale el mapa vigente: no se guarda cómo estaba antes.
--
-- Idempotente. Correr una vez en el SQL Editor de Supabase.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. Zonas y agrupaciones ─────────────────────────────────────

create table if not exists public.electoral_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0
);

create table if not exists public.agrupaciones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  zone_id    uuid references public.electoral_zones(id) on delete set null,
  sort_order int not null default 0
);

insert into public.electoral_zones (name, sort_order) values
  ('Zona 1', 1), ('Zona 2', 2), ('Zona 3', 3)
on conflict (name) do nothing;

insert into public.agrupaciones (name, sort_order) values
  ('Artigas', 1), ('Canelones Este', 2), ('Canelones Oeste', 3),
  ('Cerro Largo', 4), ('Colonia', 5), ('Durazno', 6), ('Flores', 7),
  ('Florida', 8), ('Lavalleja', 9), ('Maldonado', 10), ('Montevideo', 11),
  ('Paysandú', 12), ('Río Negro', 13), ('Rivera', 14), ('Rocha', 15),
  ('Salto', 16), ('San José', 17), ('Soriano', 18), ('Tacuarembó', 19),
  ('Treinta y Tres', 20)
on conflict (name) do nothing;

-- Los nombres los lee cualquiera (el primer ingreso los ofrece antes de
-- que la persona pertenezca a nada); los cambia el admin nacional.
alter table public.electoral_zones enable row level security;
alter table public.agrupaciones enable row level security;

drop policy if exists electoral_zones_read on public.electoral_zones;
create policy electoral_zones_read on public.electoral_zones
  for select using (true);
drop policy if exists electoral_zones_write on public.electoral_zones;
create policy electoral_zones_write on public.electoral_zones
  for all using (public.is_national_admin(auth.uid()))
  with check (public.is_national_admin(auth.uid()));

drop policy if exists agrupaciones_read on public.agrupaciones;
create policy agrupaciones_read on public.agrupaciones
  for select using (true);
drop policy if exists agrupaciones_write on public.agrupaciones;
create policy agrupaciones_write on public.agrupaciones
  for all using (public.is_national_admin(auth.uid()))
  with check (public.is_national_admin(auth.uid()));

-- ─── 2. La agrupación de una Asamblea y de una persona ───────────

alter table public.localities
  add column if not exists agrupacion_id uuid references public.agrupaciones(id) on delete set null;

-- Preferencia personal, no un permiso: `profiles_update_self` (039) la
-- deja escribir a la propia persona sin tocar nada.
alter table public.profiles
  add column if not exists agrupacion_id uuid references public.agrupaciones(id) on delete set null;

-- Las AEL que se pueden ubicar por el nombre ("Comunidad Bahá'í de
-- Salto" → Salto). Las de Canelones no matchean a propósito: "Canelones
-- Este" no está en ningún nombre, y Este u Oeste lo decide la AEN.
update public.localities l
set agrupacion_id = a.id
from public.agrupaciones a
where l.kind = 'ael'
  and l.agrupacion_id is null
  and position(lower(a.name) in lower(l.name)) > 0;

-- La agrupación EFECTIVA de una persona: la de su Asamblea Local si
-- tiene una (la más vieja, si tuviera dos), si no la que eligió. Es la
-- regla que van a usar las estructuras de agrupación y la Convención;
-- definer porque mira membresías que la RLS no le muestra a cualquiera.
create or replace function public.person_agrupacion(p_profile uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (
      select l.agrupacion_id
      from public.profile_localities m
      join public.localities l on l.id = m.locality_id
      where m.profile_id = p_profile
        and l.kind = 'ael'
        and l.agrupacion_id is not null
      order by m.created_at
      limit 1
    ),
    (select agrupacion_id from public.profiles where id = p_profile)
  );
$$;

grant execute on function public.person_agrupacion(uuid) to authenticated;
