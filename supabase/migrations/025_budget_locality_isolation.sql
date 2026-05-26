-- ═════════════════════════════════════════════════════════════════
-- Aislamiento por localidad de las tablas de presupuesto.
--
-- La migración 024 creó treasury_budgets y treasury_budget_items con
-- políticas de SELECT abiertas (`using (true)`), inconsistente con el
-- resto del esquema, que filtra por `locality_id = current_locality_id()`.
-- Eso permitía que un usuario autenticado leyera (y un tesorero editara)
-- presupuestos de otra localidad por API directa.
--
-- Esta migración reemplaza esas políticas por unas locality-scoped:
--   • treasury_budgets: tiene locality_id propio → filtro directo.
--   • treasury_budget_items: NO tiene locality_id → se resuelve vía el
--     presupuesto padre (treasury_budgets.locality_id).
--
-- SELECT: miembros de la localidad (o admin nacional). Así la vista de
--         solo-lectura en /tesoreria sigue funcionando para todos.
-- WRITE : solo tesoreros (has_treasury_tag) de la propia localidad,
--         igual que la tabla `treasury`.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── treasury_budgets ────────────────────────────────────────────
drop policy if exists "treasury_budgets_select_all" on public.treasury_budgets;
drop policy if exists "treasury_budgets_select_locality" on public.treasury_budgets;
create policy "treasury_budgets_select_locality" on public.treasury_budgets
  for select using (
    locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "treasury_budgets_tag_write" on public.treasury_budgets;
create policy "treasury_budgets_tag_write" on public.treasury_budgets
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and locality_id = public.current_locality_id()
  );

-- ─── treasury_budget_items (vía presupuesto padre) ───────────────
drop policy if exists "treasury_budget_items_select_all" on public.treasury_budget_items;
drop policy if exists "treasury_budget_items_select_locality" on public.treasury_budget_items;
create policy "treasury_budget_items_select_locality" on public.treasury_budget_items
  for select using (
    exists (
      select 1 from public.treasury_budgets b
      where b.id = treasury_budget_items.budget_id
        and (
          b.locality_id = public.current_locality_id()
          or public.is_national_admin(auth.uid())
        )
    )
  );

drop policy if exists "treasury_budget_items_tag_write" on public.treasury_budget_items;
create policy "treasury_budget_items_tag_write" on public.treasury_budget_items
  for all
  using (
    public.has_treasury_tag(auth.uid())
    and exists (
      select 1 from public.treasury_budgets b
      where b.id = treasury_budget_items.budget_id
        and b.locality_id = public.current_locality_id()
    )
  )
  with check (
    public.has_treasury_tag(auth.uid())
    and exists (
      select 1 from public.treasury_budgets b
      where b.id = treasury_budget_items.budget_id
        and b.locality_id = public.current_locality_id()
    )
  );
