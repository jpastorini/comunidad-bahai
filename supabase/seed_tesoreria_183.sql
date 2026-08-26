-- ═════════════════════════════════════════════════════════════════
-- Importación de la planilla de Tesorería — año bahá'í 183.
--
-- Generado por scripts/import-tesoreria.mjs. NO editar a mano:
-- si hay que corregir algo, se corrige el CSV y se regenera.
--
-- Requiere la migración 040_treasury_ledger.sql aplicada.
-- Es re-corrible: los asientos llevan import_ref único.
--
-- Saldos esperados al terminar:
--   Caja Chica Tesorero · USD                332,00
--   Caja Chica Tesorero · UYU              1.553,00
--   Cuenta BROU Dólares · USD             26.074,68
--   Cuenta Prex · UYU                     38.254,00
-- ═════════════════════════════════════════════════════════════════

do $import$
declare
  v_loc uuid;
  v_expected int := 54;
  v_inserted int;
begin
  select id into v_loc from public.localities where name = 'Comunidad Bahá''í de Montevideo';
  if v_loc is null then
    raise exception 'No existe la localidad %. Corregí el nombre en este archivo.', 'Comunidad Bahá''í de Montevideo';
  end if;

  -- ─── Cuentas ───────────────────────────────────────────────
  insert into public.treasury_accounts (locality_id, name, sort_order) values
    (v_loc, 'Cuenta BROU Pesos', 1),
    (v_loc, 'Cuenta BROU Dólares', 2),
    (v_loc, 'Caja Chica Tesorero', 3),
    (v_loc, 'Cuenta Auxiliar', 4),
    (v_loc, 'Cuenta Prex', 5)
  on conflict (locality_id, name) do nothing;

  -- ─── Fondos ────────────────────────────────────────────────
  insert into public.treasury_funds (locality_id, name, sort_order) values
    (v_loc, 'Fondo Local', 1),
    (v_loc, 'Fondo Enseñanza', 2),
    (v_loc, 'Fondo de Ayuda Social', 3),
    (v_loc, 'Fondo Retorno de Deuda AEN', 4),
    (v_loc, 'Fondo de Clases de Niños', 5),
    (v_loc, 'Fondo de Mantenimiento', 6)
  on conflict (locality_id, name) do nothing;

  -- ─── Categorías ────────────────────────────────────────────
  insert into public.treasury_categories (locality_id, name, sort_order) values
    (v_loc, 'Contribucion creyentes', 1),
    (v_loc, 'Gastos Operativos', 2),
    (v_loc, 'Cambio de caja', 3),
    (v_loc, 'Transacciones financieras', 4),
    (v_loc, 'Mantenimiento', 5),
    (v_loc, 'Saldo anterior', 6),
    (v_loc, 'Enseñanza', 7),
    (v_loc, 'Celebraciones', 8)
  on conflict (locality_id, name) do nothing;

  -- ─── Subcategorías (arrastran categoría y fondo) ───────────
  insert into public.treasury_subcategories (locality_id, name, category_id, default_fund_id, sort_order)
  select v_loc, v.name, c.id, f.id, v.ord
  from (values
    ('Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 1),
    ('Contrib. Fondo Enseñanza', 'Contribucion creyentes', 'Fondo Enseñanza', 2),
    ('Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 3),
    ('Actualizacion de oficiales', 'Gastos Operativos', 'Fondo Local', 4),
    ('Gastos Fúnebres', 'Gastos Operativos', 'Fondo Local', 5),
    ('Gastos Secretaria', 'Gastos Operativos', 'Fondo Local', 6),
    ('Cambio de caja', 'Cambio de caja', null::text, 7),
    ('Compra de divisas', 'Transacciones financieras', null::text, 8),
    ('Centro Bahá''í - Mantenimiento', 'Mantenimiento', 'Fondo Local', 9),
    ('Saldo anterior', 'Saldo anterior', null::text, 10),
    ('Materiales de Enseñanza', 'Enseñanza', 'Fondo Local', 11),
    ('Logistica', 'Celebraciones', 'Fondo Local', 12),
    ('Centro Bahá''í - Gastos Fijos', 'Gastos Operativos', 'Fondo Local', 13),
    ('Proyectos de Enseñanza', 'Enseñanza', 'Fondo Local', 14),
    ('Celebraciones de Días Sagrados', 'Celebraciones', 'Fondo Local', 15),
    ('Actividades Educativas', 'Enseñanza', 'Fondo Local', 16),
    ('Aporte al Fondo Nacional', 'Gastos Operativos', 'Fondo Local', 17),
    ('Gastos por transferencia', 'Transacciones financieras', 'Fondo Local', 18)
  ) as v(name, category, fund, ord)
  join public.treasury_categories c on c.locality_id = v_loc and c.name = v.category
  left join public.treasury_funds f on f.locality_id = v_loc and f.name = v.fund
  on conflict (locality_id, name) do nothing;

  -- ─── Contribuyentes ────────────────────────────────────────
  insert into public.treasury_contributors (locality_id, name, kind) values
    (v_loc, 'TEST', 'persona'),
    (v_loc, 'Siroos y Vida Vahdat', 'persona'),
    (v_loc, 'Fiesta 19 Días Jamal', 'colecta'),
    (v_loc, 'OMG Que Linda', 'persona'),
    (v_loc, 'Chintia Brown', 'persona'),
    (v_loc, 'Familia Mendoza Pereira', 'familia'),
    (v_loc, 'Sr. Larry Gates', 'persona'),
    (v_loc, 'Sra. Celeste Alvarez', 'persona'),
    (v_loc, 'Sr. Gerardo Almada', 'persona'),
    (v_loc, 'Up Montevideo', 'persona'),
    (v_loc, 'Familia Pastorini Cardona', 'familia'),
    (v_loc, 'Familia Vahdat', 'familia'),
    (v_loc, 'Layli Pastorini', 'persona'),
    (v_loc, 'Sr. Carlos Cardona', 'persona'),
    (v_loc, 'Familia Sardón Ayala', 'familia')
  on conflict do nothing;

  -- ─── Movimientos ───────────────────────────────────────────
  insert into public.treasury_entries (
    locality_id, entry_date, bahai_year, account_id, subcategory_id,
    category_id, fund_id, currency, amount, description, receipt_number,
    contributions_count, contributor_id, receipt_issued, is_opening_balance,
    transfer_group_id, import_ref
  )
  select
    v_loc, v.entry_date, 183, a.id, s.id, c.id, f.id, v.currency,
    v.amount, nullif(v.description, ''), v.receipt_number,
    v.contributions_count, ct.id, v.receipt_issued, v.is_opening,
    v.transfer_group, v.import_ref
  from (values
    ('2026-04-21'::date, 'Caja Chica Tesorero', 'Saldo anterior', 'Saldo anterior', 'Fondo Local', 'USD', 132.00, '', null::int, 0, null::text, false, true, null::uuid, '183:3'),
    ('2026-04-21'::date, 'Cuenta BROU Dólares', 'Saldo anterior', 'Saldo anterior', 'Fondo Local', 'USD', 26074.68, '', null::int, 0, null::text, false, true, null::uuid, '183:4'),
    ('2026-04-21'::date, 'Caja Chica Tesorero', 'Saldo anterior', 'Saldo anterior', 'Fondo Enseñanza', 'UYU', 500.00, '', null::int, 0, null::text, false, true, null::uuid, '183:5'),
    ('2026-04-21'::date, 'Caja Chica Tesorero', 'Saldo anterior', 'Saldo anterior', 'Fondo de Ayuda Social', 'UYU', 9245.00, '', null::int, 0, null::text, false, true, null::uuid, '183:6'),
    ('2026-04-21'::date, 'Cuenta Prex', 'Saldo anterior', 'Saldo anterior', 'Fondo Local', 'UYU', 2195.00, '', null::int, 0, null::text, false, true, null::uuid, '183:7'),
    ('2026-04-21'::date, 'Caja Chica Tesorero', 'Saldo anterior', 'Saldo anterior', 'Fondo Local', 'UYU', 5206.00, '', null::int, 0, null::text, false, true, null::uuid, '183:8'),
    ('2026-05-01'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 281, 1, 'TEST', false, false, null::uuid, '183:9'),
    ('2026-05-03'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 3000.00, 'Aporte al Fondo Local', 282, 1, 'Siroos y Vida Vahdat', false, false, null::uuid, '183:10'),
    ('2026-05-03'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 2000.00, 'Aporte al Fondo Local', 283, 5, 'Fiesta 19 Días Jamal', false, false, null::uuid, '183:11'),
    ('2026-05-14'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 2000.00, 'Aporte al Fondo Local', 284, 1, 'OMG Que Linda', false, false, null::uuid, '183:12'),
    ('2026-05-14'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 285, 1, 'Chintia Brown', false, false, null::uuid, '183:13'),
    ('2026-05-14'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 2000.00, 'Aporte al Fondo Local', 286, 1, 'Familia Mendoza Pereira', false, false, null::uuid, '183:14'),
    ('2026-05-17'::date, 'Caja Chica Tesorero', 'Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 287, 2, null::text, false, false, null::uuid, '183:15'),
    ('2026-05-17'::date, 'Caja Chica Tesorero', 'Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 288, 1, 'Sr. Larry Gates', false, false, null::uuid, '183:16'),
    ('2026-05-17'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 2000.00, 'Aporte al Fondo Local para Celebración de la Declaración del Báb', 289, 1, 'Sra. Celeste Alvarez', false, false, null::uuid, '183:17'),
    ('2026-05-17'::date, 'Caja Chica Tesorero', 'Celebraciones de Días Sagrados', 'Celebraciones', 'Fondo Local', 'UYU', -2000.00, 'Declaración del Báb', null::int, 0, null::text, false, false, null::uuid, '183:18'),
    ('2026-05-20'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Contribución al Fondo Local', 290, 1, 'Sr. Gerardo Almada', false, false, null::uuid, '183:19'),
    ('2026-05-20'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 3000.00, 'Contribución al Fondo Local', 291, 1, 'Up Montevideo', false, false, null::uuid, '183:20'),
    ('2026-05-23'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Contribución al Fondo Local', 292, 1, 'Familia Pastorini Cardona', false, false, null::uuid, '183:21'),
    ('2026-05-23'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'USD', 100.00, 'Contribución al Fondo Local', 293, 1, 'Familia Vahdat', false, false, null::uuid, '183:22'),
    ('2026-05-23'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 102.00, 'Contribución al Fondo Local', 294, 1, 'Layli Pastorini', false, false, null::uuid, '183:23'),
    ('2026-05-28'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte por Paltas', 295, 1, 'Sr. Carlos Cardona', false, false, null::uuid, '183:24'),
    ('2026-06-01'::date, 'Caja Chica Tesorero', 'Cambio de caja', 'Cambio de caja', 'Fondo Local', 'UYU', -25000.00, 'Cambio de caja', null::int, 0, null::text, false, false, '54de812a-fece-4dbb-9b28-05039750bd61'::uuid, '183:25'),
    ('2026-06-01'::date, 'Cuenta Prex', 'Cambio de caja', 'Cambio de caja', 'Fondo Local', 'UYU', 25000.00, 'Cambio de caja', null::int, 0, null::text, false, false, '54de812a-fece-4dbb-9b28-05039750bd61'::uuid, '183:26'),
    ('2026-06-01'::date, 'Cuenta Prex', 'Centro Bahá''í - Gastos Fijos', 'Gastos Operativos', 'Fondo Local', 'UYU', -11883.00, 'Pago de gastos del Centro Bahá''í', null::int, 0, null::text, false, false, null::uuid, '183:27'),
    ('2026-06-05'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Aporte al Fondo Local', 296, 1, 'Sr. Carlos Cardona', false, false, null::uuid, '183:28'),
    ('2026-06-06'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Aporte al Fondo Local', 297, 1, 'Familia Pastorini Cardona', false, false, null::uuid, '183:29'),
    ('2026-06-07'::date, 'Caja Chica Tesorero', 'Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 298, 0, 'Sr. Larry Gates', false, false, null::uuid, '183:30'),
    ('2026-06-07'::date, 'Caja Chica Tesorero', 'Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 'UYU', 920.00, 'Aporte al Fondo Local', 299, 2, null::text, false, false, null::uuid, '183:31'),
    ('2026-06-07'::date, 'Caja Chica Tesorero', 'Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 'USD', 100.00, '', null::int, 1, null::text, false, false, null::uuid, '183:32'),
    ('2026-06-10'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 300, 1, 'Chintia Brown', false, false, null::uuid, '183:33'),
    ('2026-06-20'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 3000.00, 'Contribución al Fondo Local', 301, 1, 'Up Montevideo', false, false, null::uuid, '183:34'),
    ('2026-06-25'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Contribución al Fondo Local', 302, 1, 'Sr. Gerardo Almada', false, false, null::uuid, '183:35'),
    ('2026-06-27'::date, 'Cuenta Prex', 'Proyectos de Enseñanza', 'Enseñanza', 'Fondo Local', 'UYU', -2000.00, 'Proyecto Cachimba', null::int, 0, null::text, false, false, null::uuid, '183:36'),
    ('2026-06-28'::date, 'Caja Chica Tesorero', 'Contribución Fiesta de los Diecinueve Días', 'Contribucion creyentes', 'Fondo Local', 'UYU', 2700.00, 'Contribución al Fondo Local', 303, 5, null::text, false, false, null::uuid, '183:37'),
    ('2026-06-30'::date, 'Caja Chica Tesorero', 'Celebraciones de Días Sagrados', 'Celebraciones', 'Fondo Local', 'UYU', -1500.00, 'Conmemoración del Martirio del Báb', null::int, 0, null::text, false, false, null::uuid, '183:38'),
    ('2026-07-08'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 3000.00, 'Contribución al Fondo Local', 304, 1, 'Familia Sardón Ayala', false, false, null::uuid, '183:39'),
    ('2026-07-08'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 3000.00, 'Contribución al Fondo Local', 305, 1, 'Up Montevideo', false, false, null::uuid, '183:40'),
    ('2026-07-08'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Contribución al Fondo Local', 306, 1, 'Sr. Gerardo Almada', false, false, null::uuid, '183:41'),
    ('2026-07-10'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Contribución al Fondo Local', 307, 1, 'Sr. Carlos Cardona', false, false, null::uuid, '183:42'),
    ('2026-07-14'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 2000.00, 'Contribución al Fondo Local', 308, 1, 'OMG Que Linda', false, false, null::uuid, '183:43'),
    ('2026-07-20'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 500.00, 'Contribución al Fondo Local', 309, 1, 'Sr. Carlos Cardona', false, false, null::uuid, '183:44'),
    ('2026-07-25'::date, 'Caja Chica Tesorero', 'Centro Bahá''í - Gastos Fijos', 'Gastos Operativos', 'Fondo Local', 'UYU', -10120.00, 'Pago de gastros fijos', null::int, 0, null::text, false, false, null::uuid, '183:45'),
    ('2026-07-25'::date, 'Cuenta Prex', 'Centro Bahá''í - Gastos Fijos', 'Gastos Operativos', 'Fondo Local', 'UYU', -5000.00, 'Pago de gastros fijos', null::int, 0, null::text, false, false, null::uuid, '183:46'),
    ('2026-08-01'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Aporte al Fondo Local', 310, 1, 'Familia Pastorini Cardona', false, false, null::uuid, '183:47'),
    ('2026-08-02'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Aporte al Fondo Local', 311, 1, 'Sr. Carlos Cardona', false, false, null::uuid, '183:48'),
    ('2026-08-05'::date, 'Cuenta Prex', 'Centro Bahá''í - Mantenimiento', 'Mantenimiento', 'Fondo Local', 'UYU', -5014.00, 'Materiales de puerta plegable', null::int, 0, null::text, false, false, null::uuid, '183:49'),
    ('2026-08-05'::date, 'Cuenta Prex', 'Centro Bahá''í - Mantenimiento', 'Mantenimiento', 'Fondo Local', 'UYU', -44.00, 'Transferencia', null::int, 0, null::text, false, false, null::uuid, '183:50'),
    ('2026-08-10'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 3000.00, 'Contribución al Fondo Local', 312, 1, 'Up Montevideo', false, false, null::uuid, '183:51'),
    ('2026-08-10'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Contribución al Fondo Local', 313, 1, 'Sr. Gerardo Almada', false, false, null::uuid, '183:52'),
    ('2026-08-11'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Aporte al Fondo Local', 314, 1, 'Chintia Brown', false, false, null::uuid, '183:53'),
    ('2026-08-17'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 4000.00, 'Contribución al Fondo Local', 315, 1, 'Familia Mendoza Pereira', false, false, null::uuid, '183:54'),
    ('2026-08-22'::date, 'Caja Chica Tesorero', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1000.00, 'Contribución al Fondo Local', 316, 1, 'Sr. Carlos Cardona', false, false, null::uuid, '183:55'),
    ('2026-08-22'::date, 'Cuenta Prex', 'Contribución creyentes', 'Contribucion creyentes', 'Fondo Local', 'UYU', 1500.00, 'Contribución al Fondo Local', 317, 1, 'Familia Pastorini Cardona', false, false, null::uuid, '183:56')
  ) as v(
    entry_date, account, subcategory, category, fund, currency, amount,
    description, receipt_number, contributions_count, contributor,
    receipt_issued, is_opening, transfer_group, import_ref
  )
  join public.treasury_accounts a on a.locality_id = v_loc and a.name = v.account
  join public.treasury_subcategories s on s.locality_id = v_loc and s.name = v.subcategory
  join public.treasury_categories c on c.locality_id = v_loc and c.name = v.category
  left join public.treasury_funds f on f.locality_id = v_loc and f.name = v.fund
  left join public.treasury_contributors ct
    on ct.locality_id = v_loc and lower(btrim(ct.name)) = lower(btrim(v.contributor))
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  raise notice 'Asientos insertados: % de % esperados.', v_inserted, v_expected;
  -- Si faltan filas y no es una re-corrida, algún nombre no matcheó
  -- el catálogo y el JOIN la descartó en silencio.
  if v_inserted > 0 and v_inserted < v_expected then
    raise exception 'Se insertaron % de % asientos: hay nombres que no matchean el catálogo.', v_inserted, v_expected;
  end if;
end
$import$;
