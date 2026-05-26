-- ─────────────────────────────────────────────────────────────────
-- Presupuesto anual de la Tesorería
--
-- Permite a la Asamblea definir un plan de gastos por categoría.
-- Las categorías con amount = 0 se consideran «no presupuestadas»
-- y se omiten de las metas/dashboard.
--
-- Categorías por defecto:
--   • Enseñanza
--   • Mantenimiento del Ḥaẓíratu'l-Quds / Centro Bahá'í
--   • Tareas Administrativas
--   • Ayuda Social
--   • Aporte al Fondo Nacional
--   • Aporte al Fondo Local (reserva)
--
-- La tabla treasury_budget_items almacena cada línea del plan.
-- La tabla treasury_budget guarda el período y metadatos.
-- ─────────────────────────────────────────────────────────────────

-- ─── Plan de presupuesto ──────────────────────────────────────────
create table if not exists public.treasury_budgets (
  id uuid primary key default uuid_generate_v4(),
  locality_id uuid references public.localities(id) on delete cascade,
  -- Período bahá'í (ej. "183 E.B." o "2026-2027")
  period text not null,
  -- Año bahá'í numérico para ordenamiento
  bahai_year int,
  -- Notas libres de la Asamblea sobre el presupuesto
  notes text,
  -- Estado: draft mientras se arma, active cuando la Asamblea lo aprueba
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Solo un presupuesto activo por localidad+período
  unique (locality_id, period)
);

alter table public.treasury_budgets enable row level security;

drop policy if exists "treasury_budgets_select_all" on public.treasury_budgets;
create policy "treasury_budgets_select_all" on public.treasury_budgets
  for select using (true);

drop policy if exists "treasury_budgets_tag_write" on public.treasury_budgets;
create policy "treasury_budgets_tag_write" on public.treasury_budgets
  for all
  using (public.has_treasury_tag(auth.uid()))
  with check (public.has_treasury_tag(auth.uid()));

-- ─── Líneas del presupuesto ──────────────────────────────────────
create table if not exists public.treasury_budget_items (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid not null references public.treasury_budgets(id) on delete cascade,
  -- Categoría predefinida o personalizada
  category text not null,
  -- Icono semántico para el UI (se mapea en el frontend)
  icon text not null default 'default',
  -- Monto planificado. 0 = no presupuestado (se omite en el dashboard).
  planned_amount numeric not null default 0 check (planned_amount >= 0),
  -- Monto realmente gastado (actualizado periódicamente por el tesorero)
  spent_amount numeric not null default 0 check (spent_amount >= 0),
  -- Orden de presentación
  position int not null default 0,
  -- Notas sobre esta categoría (ej. "Incluye alquiler + luz")
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists treasury_budget_items_budget_idx
  on public.treasury_budget_items (budget_id, position);

alter table public.treasury_budget_items enable row level security;

drop policy if exists "treasury_budget_items_select_all" on public.treasury_budget_items;
create policy "treasury_budget_items_select_all" on public.treasury_budget_items
  for select using (true);

drop policy if exists "treasury_budget_items_tag_write" on public.treasury_budget_items;
create policy "treasury_budget_items_tag_write" on public.treasury_budget_items
  for all
  using (public.has_treasury_tag(auth.uid()))
  with check (public.has_treasury_tag(auth.uid()));

-- ─── Función helper: total presupuestado (sin contar los 0) ──────
create or replace function public.budget_total_planned(bid uuid)
returns numeric
language sql security definer stable
set search_path = public
as $$
  select coalesce(sum(planned_amount), 0)
  from public.treasury_budget_items
  where budget_id = bid and planned_amount > 0;
$$;

create or replace function public.budget_total_spent(bid uuid)
returns numeric
language sql security definer stable
set search_path = public
as $$
  select coalesce(sum(spent_amount), 0)
  from public.treasury_budget_items
  where budget_id = bid and planned_amount > 0;
$$;
