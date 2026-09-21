-- 061 · Conciliación con el extracto: importaciones, líneas y pares.
--
-- Hasta acá la conciliación (Tesorería → Conciliación) comparaba en
-- memoria y no guardaba nada. Esto persiste las tres cosas que pasaban
-- en la pantalla, para que importar sea acumulativo y el mes pueda decir
-- "conciliado":
--
--  · La IMPORTACIÓN es evidencia: qué archivo, de qué cuenta, qué período
--    cubrió, qué saldo declaró la plataforma, quién y cuándo. El archivo
--    original va al bucket PRIVADO `extractos` (mismo molde que los
--    comprobantes, 043): trae nombres de quien giró y vale lo mismo que
--    el libro.
--  · Las LÍNEAS llevan una huella única por cuenta (fecha + importe +
--    moneda + descripción + referencia + memo, con sufijo para las
--    repetidas dentro de un mismo archivo). Es lo que hace que el BROU
--    funcione: eBROU exporta los últimos 20 movimientos y cada archivo se
--    superpone con el anterior, así que re-importar tiene que ser gratis.
--    Una línea ya conocida se ignora (`on conflict do nothing`).
--  · Los PARES unen una línea con uno o más movimientos del libro (Prex
--    mete la comisión adentro del importe: una línea, dos asientos). Un
--    movimiento cierra contra UNA línea (`unique (entry_id)`). El motor
--    los guarda solo (`matched_by = 'motor'`); el tesorero agrega a mano
--    los que el motor no encontró y descarta las líneas que no le
--    corresponden al libro (una transferencia devuelta, un movimiento de
--    otra cuenta), con motivo.
--
-- "Conciliado" NO se guarda: se deriva (como "Aprobado" en los informes).
-- Un mes de una cuenta está conciliado cuando hay líneas que lo cubren,
-- todas tienen par o descarte, y todos los movimientos del libro de esa
-- cuenta en el mes tienen par. Lo calcula `lib/treasury-statements.ts`.
--
-- Borrar un movimiento del libro suelta su par (cascade) y la línea vuelve
-- a pendiente. Borrar una importación se lleva sus líneas y sus pares: es
-- para el archivo subido a la cuenta equivocada, y se re-importa.
--
-- Confidencialidad: las tres tablas detrás del tag `can_manage_treasury`
-- y la localidad del sombrero puesto, como el libro.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1. La importación ───────────────────────────────────────────

create table if not exists public.treasury_statement_imports (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  account_id uuid not null references public.treasury_accounts(id) on delete restrict,
  platform text not null check (platform in ('prex', 'brou', 'mercadopago')),
  file_name text not null,
  -- <locality_id>/<account_id>/<uuid>.<ext> en el bucket `extractos`.
  storage_path text unique,
  period_from date not null,
  period_to date not null,
  currency text not null check (currency in ('UYU', 'USD')),
  -- El saldo que declara la plataforma, si el archivo lo trae (BROU) y a
  -- qué fecha. Prex no lo trae.
  closing_balance numeric(14, 2),
  closing_balance_as_of date,
  lines_count int not null default 0,
  new_lines_count int not null default 0,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists treasury_statement_imports_account_idx
  on public.treasury_statement_imports (account_id, created_at desc);

drop trigger if exists set_locality_treasury_statement_imports on public.treasury_statement_imports;
create trigger set_locality_treasury_statement_imports
  before insert on public.treasury_statement_imports
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_statement_imports enable row level security;

drop policy if exists "treasury_statement_imports_tag_all" on public.treasury_statement_imports;
create policy "treasury_statement_imports_tag_all" on public.treasury_statement_imports
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 2. Las líneas ───────────────────────────────────────────────

create table if not exists public.treasury_statement_lines (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  account_id uuid not null references public.treasury_accounts(id) on delete restrict,
  import_id uuid not null references public.treasury_statement_imports(id) on delete cascade,
  platform text not null check (platform in ('prex', 'brou', 'mercadopago')),
  -- Huella estable de la línea (ver lineFingerprint en lib/bank-statements.ts).
  fingerprint text not null,
  line_date date not null,
  -- Con signo: positivo entró a la cuenta, negativo salió.
  amount numeric(14, 2) not null check (amount <> 0),
  currency text not null check (currency in ('UYU', 'USD')),
  description text not null default '',
  -- BROU: el "Asunto", lo que escribió quien giró.
  memo text,
  -- Número de la transferencia o del documento, si la plataforma lo da.
  reference text,
  -- Prex: el importe pedido cuando la comisión va adentro del cobrado.
  gross_amount numeric(14, 2),
  -- Descartada: no le corresponde ningún asiento (devuelta por la
  -- plataforma, movimiento de otra cuenta…). Con motivo, siempre.
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null,
  dismiss_reason text,
  -- true cuando la descartó el motor (transferencia rechazada + devolución).
  dismissed_auto boolean not null default false,
  created_at timestamptz not null default now(),
  unique (account_id, fingerprint)
);

create index if not exists treasury_statement_lines_account_date_idx
  on public.treasury_statement_lines (account_id, line_date);

create index if not exists treasury_statement_lines_import_idx
  on public.treasury_statement_lines (import_id);

drop trigger if exists set_locality_treasury_statement_lines on public.treasury_statement_lines;
create trigger set_locality_treasury_statement_lines
  before insert on public.treasury_statement_lines
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_statement_lines enable row level security;

drop policy if exists "treasury_statement_lines_tag_all" on public.treasury_statement_lines;
create policy "treasury_statement_lines_tag_all" on public.treasury_statement_lines
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 3. Los pares ────────────────────────────────────────────────

create table if not exists public.treasury_statement_matches (
  id uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  line_id uuid not null references public.treasury_statement_lines(id) on delete cascade,
  -- Si se borra el movimiento, la línea vuelve a pendiente.
  entry_id uuid not null references public.treasury_entries(id) on delete cascade,
  -- Cómo cerró: mismo importe, comisión adentro, dos que suman, o a mano.
  kind text not null check (kind in ('exacto', 'comision', 'suma', 'manual')),
  matched_by text not null check (matched_by in ('motor', 'tesorero')),
  matched_by_user uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Un movimiento del libro cierra contra UNA línea del extracto.
  unique (entry_id)
);

create index if not exists treasury_statement_matches_line_idx
  on public.treasury_statement_matches (line_id);

drop trigger if exists set_locality_treasury_statement_matches on public.treasury_statement_matches;
create trigger set_locality_treasury_statement_matches
  before insert on public.treasury_statement_matches
  for each row execute function public.set_locality_from_auth();

alter table public.treasury_statement_matches enable row level security;

drop policy if exists "treasury_statement_matches_tag_all" on public.treasury_statement_matches;
create policy "treasury_statement_matches_tag_all" on public.treasury_statement_matches
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── 4. Storage: el archivo original, en bucket PRIVADO ──────────

insert into storage.buckets (id, name, public)
values ('extractos', 'extractos', false)
on conflict (id) do update set public = false;

drop policy if exists "extractos_read" on storage.objects;
create policy "extractos_read" on storage.objects
  for select using (
    bucket_id = 'extractos'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "extractos_insert" on storage.objects;
create policy "extractos_insert" on storage.objects
  for insert with check (
    bucket_id = 'extractos'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );

drop policy if exists "extractos_delete" on storage.objects;
create policy "extractos_delete" on storage.objects
  for delete using (
    bucket_id = 'extractos'
    and public.has_treasury_tag(auth.uid())
    and (storage.foldername(name))[1] = public.current_locality_id()::text
  );
