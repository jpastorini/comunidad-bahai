-- ═════════════════════════════════════════════════════════════════
-- Libro de Tesorería: los movimientos pasan a ser la fuente de verdad.
--
-- Hasta ahora la app guardaba el RESULTADO de la tesorería: la tabla
-- `treasury` tiene una sola fila por localidad con `current_amount`
-- escrito a mano en un formulario. El libro real vivía en una planilla.
--
-- Esta migración trae la planilla adentro. A partir de acá:
--   · Se cargan MOVIMIENTOS. El saldo, los totales por fondo y el
--     ejecutado del presupuesto son consultas, no columnas.
--   · El saldo no es un número: es una matriz cuenta × moneda. La misma
--     caja puede tener pesos y dólares al mismo tiempo.
--   · La plata está "coloreada" por fondo (Local, Enseñanza, Ayuda
--     Social…): dos movimientos en la misma cuenta pueden pertenecer a
--     fondos distintos y no deben sumarse entre sí.
--
-- Modelo (refleja las tablas de validación de la planilla de origen):
--   treasury_accounts       — cuentas y cajas. SIN moneda propia.
--   treasury_funds          — fondos.
--   treasury_categories     — agrupador grueso, para reportes.
--   treasury_subcategories  — el rubro que se elige al cargar; arrastra
--                             su categoría y su fondo por defecto.
--   treasury_contributors   — quién aportó. Puede ser una persona, una
--                             familia, un negocio o una colecta (la
--                             canasta de la Fiesta), y puede o no estar
--                             vinculado al perfil de un creyente.
--   treasury_entries        — el libro.
--
-- CONFIDENCIALIDAD: el detalle (movimientos y contribuyentes) es
-- exclusivo de quien tiene el tag `can_manage_treasury`. Un miembro de
-- la Asamblea SIN ese tag no lee estas tablas ni por API directa; los
-- totales agregados para la Asamblea se resuelven aparte, con funciones
-- security definer que no exponen nombres.
--
-- El catálogo (cuentas, fondos, categorías, subcategorías) se siembra
-- por localidad; ver supabase/seed_tesoreria.sql.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── Cuentas y cajas ─────────────────────────────────────────────
create table if not exists public.treasury_accounts (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  name text not null,
  -- Sin columna de moneda a propósito: "Caja Chica Tesorero" tiene
  -- pesos y dólares conviviendo. La moneda es del movimiento.
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (locality_id, name)
);

-- ─── Fondos ──────────────────────────────────────────────────────
create table if not exists public.treasury_funds (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (locality_id, name)
);

-- ─── Categorías (agrupador de reportes) ──────────────────────────
create table if not exists public.treasury_categories (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (locality_id, name)
);

-- ─── Subcategorías (lo que se elige al cargar) ───────────────────
create table if not exists public.treasury_subcategories (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  name text not null,
  category_id uuid not null references public.treasury_categories(id) on delete restrict,
  -- Fondo sugerido al elegir esta subcategoría. Puede quedar NULL:
  -- "Cambio de caja", "Compra de divisas" y "Saldo anterior" no
  -- pertenecen a ningún fondo en particular.
  default_fund_id uuid references public.treasury_funds(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (locality_id, name)
);

-- ─── Contribuyentes ──────────────────────────────────────────────
create table if not exists public.treasury_contributors (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  name text not null,
  -- La misma persona puede aportar de varias maneras (a título personal,
  -- por su familia o por su negocio); cada una es un contribuyente
  -- distinto y todas pueden apuntar al mismo perfil.
  kind text not null default 'persona'
    check (kind in ('persona', 'familia', 'negocio', 'colecta', 'otro')),
  -- Vínculo OPCIONAL con el creyente. NULL para colectas ("Fiesta de los
  -- 19 Días") o para quien no usa la app.
  profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un solo contribuyente por nombre normalizado: evita que "Up Montevideo"
-- y "Up Montevideo " (con espacio al final) queden como dos.
create unique index if not exists treasury_contributors_name_uniq
  on public.treasury_contributors (locality_id, lower(btrim(name)));

create index if not exists treasury_contributors_profile_idx
  on public.treasury_contributors (profile_id)
  where profile_id is not null;

-- ─── El libro ────────────────────────────────────────────────────
create table if not exists public.treasury_entries (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  entry_date date not null,
  -- Año bahá'í del ejercicio. La planilla es una por año ("Tesorería
  -- 183") y el corte no se puede derivar de la fecha: lo define la
  -- Asamblea al abrir el período.
  bahai_year int,
  account_id uuid not null references public.treasury_accounts(id) on delete restrict,
  subcategory_id uuid not null references public.treasury_subcategories(id) on delete restrict,
  -- Se copian al cargar (desde la subcategoría) y quedan editables: si
  -- mañana se recategoriza un rubro, los asientos viejos no cambian.
  category_id uuid not null references public.treasury_categories(id) on delete restrict,
  fund_id uuid references public.treasury_funds(id) on delete restrict,
  currency text not null check (currency in ('UYU', 'USD')),
  -- Con signo: positivo = ingreso, negativo = gasto. Sumar es el caso
  -- común; la UI lo muestra en dos columnas, como la planilla.
  amount numeric(14, 2) not null check (amount <> 0),
  description text,
  -- Numeración correlativa de recibos, única por localidad.
  receipt_number int,
  -- Cuántos aportes agrupa el asiento: la canasta de la Fiesta entra
  -- como una línea con varios aportes anónimos.
  contributions_count int not null default 0 check (contributions_count >= 0),
  contributor_id uuid references public.treasury_contributors(id) on delete set null,
  -- Estado del recibo (la columna TRUE/FALSE de la planilla, que
  -- alimentaba el script de emisión).
  receipt_issued boolean not null default false,
  receipt_issued_at timestamptz,
  -- Ata las dos patas de una misma operación: un cambio de caja o una
  -- compra de divisas son una salida y una entrada que viajan juntas
  -- (y pueden estar en monedas distintas).
  transfer_group_id uuid,
  -- Saldo de apertura del período. No es un ingreso real.
  is_opening_balance boolean not null default false,
  -- Marca de importación, para poder re-correr el import sin duplicar.
  import_ref text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists treasury_entries_receipt_uniq
  on public.treasury_entries (locality_id, receipt_number)
  where receipt_number is not null;

create unique index if not exists treasury_entries_import_uniq
  on public.treasury_entries (locality_id, import_ref)
  where import_ref is not null;

create index if not exists treasury_entries_date_idx
  on public.treasury_entries (locality_id, entry_date desc);

create index if not exists treasury_entries_fund_idx
  on public.treasury_entries (locality_id, fund_id, currency);

create index if not exists treasury_entries_account_idx
  on public.treasury_entries (locality_id, account_id, currency);

create index if not exists treasury_entries_contributor_idx
  on public.treasury_entries (contributor_id)
  where contributor_id is not null;

create index if not exists treasury_entries_transfer_idx
  on public.treasury_entries (transfer_group_id)
  where transfer_group_id is not null;

-- ─── Auto-llenado de locality_id ─────────────────────────────────
drop trigger if exists set_locality_treasury_accounts on public.treasury_accounts;
create trigger set_locality_treasury_accounts
  before insert on public.treasury_accounts
  for each row execute function public.set_locality_from_auth();

drop trigger if exists set_locality_treasury_funds on public.treasury_funds;
create trigger set_locality_treasury_funds
  before insert on public.treasury_funds
  for each row execute function public.set_locality_from_auth();

drop trigger if exists set_locality_treasury_categories on public.treasury_categories;
create trigger set_locality_treasury_categories
  before insert on public.treasury_categories
  for each row execute function public.set_locality_from_auth();

drop trigger if exists set_locality_treasury_subcategories on public.treasury_subcategories;
create trigger set_locality_treasury_subcategories
  before insert on public.treasury_subcategories
  for each row execute function public.set_locality_from_auth();

drop trigger if exists set_locality_treasury_contributors on public.treasury_contributors;
create trigger set_locality_treasury_contributors
  before insert on public.treasury_contributors
  for each row execute function public.set_locality_from_auth();

drop trigger if exists set_locality_treasury_entries on public.treasury_entries;
create trigger set_locality_treasury_entries
  before insert on public.treasury_entries
  for each row execute function public.set_locality_from_auth();

-- ═════════════════════════════════════════════════════════════════
-- RLS
--
-- Catálogo: lo LEE cualquier miembro de la localidad —son nombres de
-- rubros, no dicen nada de la plata— y lo escribe solo el tesorero.
-- Libro y contribuyentes: solo el tesorero, ni lectura para el resto.
-- ═════════════════════════════════════════════════════════════════

alter table public.treasury_accounts enable row level security;
alter table public.treasury_funds enable row level security;
alter table public.treasury_categories enable row level security;
alter table public.treasury_subcategories enable row level security;
alter table public.treasury_contributors enable row level security;
alter table public.treasury_entries enable row level security;

-- ─── Cuentas ─────────────────────────────────────────────────────
drop policy if exists "treasury_accounts_select_locality" on public.treasury_accounts;
create policy "treasury_accounts_select_locality" on public.treasury_accounts
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_accounts_tag_write" on public.treasury_accounts;
create policy "treasury_accounts_tag_write" on public.treasury_accounts
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Fondos ──────────────────────────────────────────────────────
drop policy if exists "treasury_funds_select_locality" on public.treasury_funds;
create policy "treasury_funds_select_locality" on public.treasury_funds
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_funds_tag_write" on public.treasury_funds;
create policy "treasury_funds_tag_write" on public.treasury_funds
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Categorías ──────────────────────────────────────────────────
drop policy if exists "treasury_categories_select_locality" on public.treasury_categories;
create policy "treasury_categories_select_locality" on public.treasury_categories
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_categories_tag_write" on public.treasury_categories;
create policy "treasury_categories_tag_write" on public.treasury_categories
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Subcategorías ───────────────────────────────────────────────
drop policy if exists "treasury_subcategories_select_locality" on public.treasury_subcategories;
create policy "treasury_subcategories_select_locality" on public.treasury_subcategories
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_subcategories_tag_write" on public.treasury_subcategories;
create policy "treasury_subcategories_tag_write" on public.treasury_subcategories
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Contribuyentes (solo tesorero) ──────────────────────────────
drop policy if exists "treasury_contributors_tag_all" on public.treasury_contributors;
create policy "treasury_contributors_tag_all" on public.treasury_contributors
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Libro (solo tesorero) ───────────────────────────────────────
drop policy if exists "treasury_entries_tag_all" on public.treasury_entries;
create policy "treasury_entries_tag_all" on public.treasury_entries
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── Próximo número de recibo ────────────────────────────────────
-- Security definer para que devuelva el correlativo aunque la fila más
-- alta la haya cargado otro tesorero.
create or replace function public.next_receipt_number(loc uuid)
returns int
language sql security definer stable
set search_path = public
as $$
  select coalesce(max(receipt_number), 0) + 1
  from public.treasury_entries
  where locality_id = loc;
$$;
