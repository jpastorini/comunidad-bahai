-- 079 — Aportes por Mercado Pago.
--
-- El creyente elige el monto (y el fondo, si hay más de uno habilitado),
-- paga en Mercado Pago y el aporte entra SOLO al libro: el ingreso por el
-- BRUTO, a nombre de su ficha de contribuyente, con número de recibo, y
-- un gasto aparte por la comisión y la retención. Es la regla acordada
-- para Mercado Pago (061): el recibo dice lo que la persona dio y el
-- gasto no se esconde.
--
-- Tres piezas:
--   · treasury_funds.online_contributions — qué fondos se ofrecen en la
--     app. Lo decide el tesorero en el Catálogo; se siembra solo el Local.
--   · treasury_mp_settings — la cuenta de Mercado Pago de cada comunidad
--     (credenciales) y con qué cuenta y rubros del libro se registra.
--     SIN policies: la leen y escriben solo funciones de servidor con
--     service-role, después de chequear el tag de Tesorería. Un access
--     token no puede quedar al alcance de PostgREST.
--   · treasury_online_contributions — cada intento de aporte, desde que
--     la persona toca "Pagar" hasta que el pago se acredita. Su id viaja
--     a Mercado Pago como `external_reference`; el número de pago es
--     único, y eso es lo que impide registrar dos veces el mismo aporte
--     cuando Mercado Pago repite el aviso.
--
-- Correr una vez en el SQL Editor de Supabase.

-- ─── Fondos que se ofrecen en la app ─────────────────────────────
alter table public.treasury_funds
  add column if not exists online_contributions boolean not null default false;

comment on column public.treasury_funds.online_contributions is
  'Se ofrece al creyente al aportar por Mercado Pago desde la app (079).';

-- Arranca solo el Fondo Local de cada comunidad.
update public.treasury_funds
   set online_contributions = true
 where is_active
   and lower(name) like '%local%';

-- ─── La cuenta de Mercado Pago de la comunidad ───────────────────
create table if not exists public.treasury_mp_settings (
  locality_id uuid primary key references public.localities(id) on delete cascade,
  enabled boolean not null default false,
  access_token text,
  -- La clave secreta de Webhooks del panel de Mercado Pago. Opcional: el
  -- aviso nunca se cree por lo que dice, se consulta el pago a la API con
  -- el access token. Con la clave, además se verifica la firma.
  webhook_secret text,
  -- Con qué se registra en el libro.
  account_id uuid references public.treasury_accounts(id) on delete set null,
  income_subcategory_id uuid references public.treasury_subcategories(id) on delete set null,
  fee_subcategory_id uuid references public.treasury_subcategories(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.treasury_mp_settings enable row level security;
-- Sin policies a propósito (ver arriba).

-- ─── Cada intento de aporte ──────────────────────────────────────
create table if not exists public.treasury_online_contributions (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid not null references public.localities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fund_id uuid references public.treasury_funds(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'UYU' check (currency in ('UYU', 'USD')),
  receipt_name text,
  -- creado → (pendiente) → aprobado | rechazado | devuelto
  status text not null default 'creado'
    check (status in ('creado', 'pendiente', 'aprobado', 'rechazado', 'devuelto')),
  mp_preference_id text,
  mp_payment_id text,
  mp_status_detail text,
  fee_amount numeric(14, 2),
  entry_id uuid references public.treasury_entries(id) on delete set null,
  fee_entry_id uuid references public.treasury_entries(id) on delete set null,
  -- Marca de "lo estoy registrando": el aviso de Mercado Pago y la vuelta
  -- de la persona a la app pueden llegar a la vez.
  claimed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists treasury_online_contributions_payment_uniq
  on public.treasury_online_contributions (mp_payment_id)
  where mp_payment_id is not null;

create index if not exists treasury_online_contributions_profile_idx
  on public.treasury_online_contributions (profile_id, created_at desc);

create index if not exists treasury_online_contributions_locality_idx
  on public.treasury_online_contributions (locality_id, created_at desc);

alter table public.treasury_online_contributions enable row level security;

-- La persona ve los suyos (la pantalla de "gracias" y su historial).
-- Escribe solo el servidor con service-role: el monto y el estado no
-- pueden venir del navegador.
drop policy if exists "online_contrib_select_own" on public.treasury_online_contributions;
create policy "online_contrib_select_own" on public.treasury_online_contributions
  for select using (profile_id = auth.uid());

-- El tesorero ve los de su comunidad, para seguir los pendientes.
drop policy if exists "online_contrib_select_treasury" on public.treasury_online_contributions;
create policy "online_contrib_select_treasury" on public.treasury_online_contributions
  for select using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );
