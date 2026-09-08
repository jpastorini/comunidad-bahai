-- ═════════════════════════════════════════════════════════════════
-- 052 · Datos de la Asamblea: la ficha legal y quiénes la integran.
--
-- Lo que la Asamblea necesita tener a mano para el trabajo cotidiano
-- —el RUT en DGI, el número de empresa en BPS, el nombre con que está
-- registrada, la fecha de registro, los estatutos en PDF— y la
-- composición de cada ejercicio: los nueve miembros y los cuatro
-- oficiales (Coordinador/a, Vicecoordinador/a, Secretario/a,
-- Tesorero/a).
--
-- Tres decisiones, tomadas con el usuario:
--
--   · Tabla NUEVA, no columnas en `localities`. La policy de lectura de
--     `localities` es `using (true)` y la app la sirve desde un caché
--     con cliente anónimo: un RUT ahí quedaría legible para cualquier
--     persona de cualquier localidad. Acá lee y escribe solo la
--     Asamblea de la localidad (rol admin), más el admin nacional.
--   · La composición se guarda POR EJERCICIO (Riḍván a Riḍván, el mismo
--     corte que la Tesorería: la Asamblea se elige en Riḍván). Se ve la
--     del ejercicio en curso y se puede consultar quiénes fueron en los
--     anteriores. El año va como número BE (183, 184…).
--   · Es una ficha INFORMATIVA. Los permisos siguen saliendo de los
--     tags de `profiles` (`can_manage_treasury`, `can_respond_chat`) y
--     la firma del recibo sigue deduciendo al tesorero del tag. La
--     pantalla avisa si el oficial declarado no tiene el tag; no lo
--     asigna.
--
-- El PDF de los estatutos va a un bucket PRIVADO (`asamblea-docs`),
-- mismo molde que los comprobantes de Tesorería (043): URL firmada de
-- vida corta emitida en el servidor, paths <locality_id>/estatutos/….
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La ficha legal, una por localidad ──────────────────────────

create table if not exists public.assembly_records (
  id                   uuid primary key default gen_random_uuid(),
  locality_id          uuid not null unique references public.localities(id) on delete cascade,
  registered_name      text,
  -- Identificadores fiscales uruguayos. Texto, no número: llevan ceros
  -- a la izquierda y a veces guiones.
  rut                  text,
  bps_number           text,
  registered_at        date,
  -- Lo que no previmos: N.º de personería, domicilio fiscal, quién es el
  -- contador, etc.
  notes                text,
  statutes_path        text,
  statutes_file_name   text,
  statutes_uploaded_at timestamptz,
  updated_by           uuid references public.profiles(id) on delete set null,
  updated_at           timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

drop trigger if exists set_locality_assembly_records on public.assembly_records;
create trigger set_locality_assembly_records
  before insert on public.assembly_records
  for each row execute function public.set_locality_from_auth();

alter table public.assembly_records enable row level security;

drop policy if exists "assembly_records_admin_all" on public.assembly_records;
create policy "assembly_records_admin_all" on public.assembly_records
  for all to authenticated
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 2. Los ejercicios ─────────────────────────────────────────────
-- Una fila por (localidad, año BE). `elected_on` es la fecha de la
-- elección (el primer día de Riḍván, salvo elección extraordinaria).

create table if not exists public.assembly_terms (
  id          uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  bahai_year  int  not null check (bahai_year between 100 and 400),
  elected_on  date,
  notes       text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (locality_id, bahai_year)
);

drop trigger if exists set_locality_assembly_terms on public.assembly_terms;
create trigger set_locality_assembly_terms
  before insert on public.assembly_terms
  for each row execute function public.set_locality_from_auth();

alter table public.assembly_terms enable row level security;

drop policy if exists "assembly_terms_admin_all" on public.assembly_terms;
create policy "assembly_terms_admin_all" on public.assembly_terms
  for all to authenticated
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 3. Los nueve miembros de cada ejercicio ───────────────────────
-- `profile_id` enlaza con la persona en la app cuando está; el nombre
-- se guarda SIEMPRE en `display_name`, porque la composición de 182 no
-- puede cambiar porque alguien se fue de la app o cambió su nombre de
-- Google. `locality_id` va denormalizado para que la RLS no tenga que
-- pasar por el ejercicio.

create table if not exists public.assembly_members (
  id           uuid primary key default gen_random_uuid(),
  term_id      uuid not null references public.assembly_terms(id) on delete cascade,
  locality_id  uuid not null references public.localities(id) on delete cascade,
  position     int  not null check (position between 1 and 9),
  profile_id   uuid references public.profiles(id) on delete set null,
  display_name text not null,
  office       text check (office in ('coordinador', 'vicecoordinador', 'secretario', 'tesorero')),
  created_at   timestamptz not null default now(),
  unique (term_id, position)
);

-- Un solo Coordinador/a, un solo Tesorero/a… por ejercicio.
create unique index if not exists assembly_members_office_uniq
  on public.assembly_members (term_id, office)
  where office is not null;

drop trigger if exists set_locality_assembly_members on public.assembly_members;
create trigger set_locality_assembly_members
  before insert on public.assembly_members
  for each row execute function public.set_locality_from_auth();

alter table public.assembly_members enable row level security;

drop policy if exists "assembly_members_admin_all" on public.assembly_members;
create policy "assembly_members_admin_all" on public.assembly_members
  for all to authenticated
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or public.is_national_admin(auth.uid())
  );

-- ─── 4. Storage: bucket PRIVADO para los estatutos ─────────────────
-- `public = false`: no hay URL pública que valga. Todo acceso sale de
-- una URL firmada emitida en el servidor, después de comprobar el rol.

insert into storage.buckets (id, name, public)
values ('asamblea-docs', 'asamblea-docs', false)
on conflict (id) do update set public = false;

-- Los paths son <locality_id>/estatutos/<uuid>.pdf: la primera carpeta
-- alcanza para aislar localidades.
drop policy if exists "asamblea_docs_read" on storage.objects;
create policy "asamblea_docs_read" on storage.objects
  for select using (
    bucket_id = 'asamblea-docs'
    and public.is_admin(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "asamblea_docs_insert" on storage.objects;
create policy "asamblea_docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'asamblea-docs'
    and public.is_admin(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "asamblea_docs_delete" on storage.objects;
create policy "asamblea_docs_delete" on storage.objects
  for delete using (
    bucket_id = 'asamblea-docs'
    and public.is_admin(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );
