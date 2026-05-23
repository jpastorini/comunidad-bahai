-- ═════════════════════════════════════════════════════════════════
-- Días Sagrados — viven como filas en `calendar_events` con kind
-- 'dia_sagrado_no_trabajo' o 'dia_sagrado_con_trabajo'.
--
-- Tres columnas nuevas dan soporte a la siembra automática:
--   * is_system_seeded — true para eventos creados por el sistema
--     (Días Sagrados, y a futuro otros eventos canónicos). Marca a
--     la Asamblea que NO se borran ni se renombran.
--   * system_id        — identificador estable por año Badí'
--     (ej. 'holy_naw_ruz_BE183'). Permite unicidad y re-siembra
--     idempotente por localidad.
--   * official_date    — fecha gregoriana oficial. La fila guarda en
--     day/month/year la fecha de CELEBRACIÓN (noche anterior o
--     horario exacto). Para mostrar el patrón "Fecha oficial · 9 de
--     julio · Conmemoración a las 12:00", la app usa este campo.
--
-- La siembra real ocurre en TypeScript (lib/holy-days.ts) al abrir
-- el panel admin, igual que con las Fiestas.
-- ═════════════════════════════════════════════════════════════════

alter table public.calendar_events
  add column if not exists is_system_seeded boolean not null default false;

alter table public.calendar_events
  add column if not exists system_id text;

alter table public.calendar_events
  add column if not exists official_date date;

-- Unicidad por (localidad, system_id) cuando system_id está seteado.
create unique index if not exists calendar_events_system_id_unique
  on public.calendar_events (locality_id, system_id)
  where system_id is not null;

create index if not exists calendar_events_official_date_idx
  on public.calendar_events (official_date);
