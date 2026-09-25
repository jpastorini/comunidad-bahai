-- 067 · Una línea del presupuesto se ejecuta con VARIOS rubros del libro
--
-- Pedido el 2026-09-25: "Mantenimiento" (75.000) se gasta en dos rubros
-- del libro a la vez, "Centro Bahá'í - Mantenimiento" y "Centro Bahá'í -
-- Gastos Fijos", y el desplegable "Se ejecuta con" (042) admitía uno solo.
--
-- Son dos listas (categorías y subcategorías) en la misma fila en vez de
-- una tabla de vínculos: la RLS de treasury_budget_items no cambia y
-- todos los que leen el presupuesto siguen leyendo una sola fila. Las
-- listas no llevan FK; el catálogo (lib/treasury-catalog.ts) las cuenta
-- como uso, así que un rubro vinculado no se puede eliminar, solo
-- desactivar.
--
-- Las columnas viejas (ledger_category_id / ledger_subcategory_id) quedan
-- por compatibilidad: se copian acá a las listas y la app deja de
-- escribirlas (las pone en NULL al guardar).

alter table public.treasury_budget_items
  add column if not exists ledger_category_ids uuid[] not null default '{}',
  add column if not exists ledger_subcategory_ids uuid[] not null default '{}';

update public.treasury_budget_items
set ledger_category_ids = array[ledger_category_id]
where ledger_category_id is not null
  and cardinality(ledger_category_ids) = 0;

update public.treasury_budget_items
set ledger_subcategory_ids = array[ledger_subcategory_id]
where ledger_subcategory_id is not null
  and cardinality(ledger_subcategory_ids) = 0;
