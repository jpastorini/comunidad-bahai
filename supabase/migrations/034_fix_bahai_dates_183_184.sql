-- 034_fix_bahai_dates_183_184.sql
--
-- Corrige fechas oficiales del calendario Badí' que estaban un día antes
-- de lo publicado por la Casa Universal de Justicia.
--
-- Causa raíz: Naw-Rúz 183 BE es el 21 de marzo de 2026 (no el 20). Eso
-- corrió un día todas las fechas ancladas al equinoccio: las 19 Fiestas
-- (inicios de mes 1–18) y 6 Días Sagrados. Además, la Declaración del Báb
-- de 184 BE estaba el 23 en lugar del 24 de mayo de 2027.
--
-- Fuente verificada (2026-06-07):
--   https://www.bahai.org/action/devotional-life/calendar  (183 BE)
--   y tabla de Días Sagrados de Wikipedia (184 BE), coincidentes.
--
-- El seed (lib/feasts.ts, lib/holy-days.ts) es idempotente y NO re-siembra
-- si ya existen filas, por eso hay que corregir las existentes acá. La data
-- fuente (lib/bahai-calendar.ts) ya quedó corregida para futuras siembras.
--
-- Idempotente: usa valores absolutos, se puede correr más de una vez.

-- ── Fiestas (tabla feasts) — 183 BE, meses 1 a 18 (+1 día). El mes 19
--    ('Alá, mes de ayuno) ya estaba correcto: 2 mar 2027. Aplica a todas
--    las localidades. ────────────────────────────────────────────────
UPDATE feasts AS f
SET gregorian_date = c.correct_date::date
FROM (VALUES
  (1,  '2026-03-21'),
  (2,  '2026-04-09'),
  (3,  '2026-04-28'),
  (4,  '2026-05-17'),
  (5,  '2026-06-05'),
  (6,  '2026-06-24'),
  (7,  '2026-07-13'),
  (8,  '2026-08-01'),
  (9,  '2026-08-20'),
  (10, '2026-09-08'),
  (11, '2026-09-27'),
  (12, '2026-10-16'),
  (13, '2026-11-04'),
  (14, '2026-11-23'),
  (15, '2026-12-12'),
  (16, '2026-12-31'),
  (17, '2027-01-19'),
  (18, '2027-02-07')
) AS c(month_index, correct_date)
WHERE f.bahai_year = 183
  AND f.bahai_month_index = c.month_index;

-- ── Días Sagrados (tabla calendar_events, is_system_seeded) ──────────
--    Se actualiza official_date (fecha oficial) y la fecha de celebración
--    que ve el miembro (year/month/day). Para los de "noche anterior" la
--    celebración es official - 1 día; el Martirio del Báb usa horario
--    exacto (mediodía) así que celebración = fecha oficial.
--    system_id incluye el año Badí' y aplica a todas las localidades.

-- 183 BE
UPDATE calendar_events SET official_date = '2026-03-21', year = 2026, month = 3, day = 20
  WHERE system_id = 'holy_naw_ruz_BE183';
UPDATE calendar_events SET official_date = '2026-04-21', year = 2026, month = 4, day = 20
  WHERE system_id = 'holy_ridvan_1_BE183';
UPDATE calendar_events SET official_date = '2026-04-29', year = 2026, month = 4, day = 28
  WHERE system_id = 'holy_ridvan_9_BE183';
UPDATE calendar_events SET official_date = '2026-05-02', year = 2026, month = 5, day = 1
  WHERE system_id = 'holy_ridvan_12_BE183';
UPDATE calendar_events SET official_date = '2026-05-24', year = 2026, month = 5, day = 23
  WHERE system_id = 'holy_declaration_bab_BE183';
UPDATE calendar_events SET official_date = '2026-07-10', year = 2026, month = 7, day = 10
  WHERE system_id = 'holy_martyrdom_bab_BE183';

-- 184 BE (solo la Declaración del Báb estaba corrida)
UPDATE calendar_events SET official_date = '2027-05-24', year = 2027, month = 5, day = 23
  WHERE system_id = 'holy_declaration_bab_BE184';
