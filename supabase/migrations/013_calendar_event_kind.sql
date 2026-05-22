-- ═════════════════════════════════════════════════════════════════
-- Categoría visual de eventos del calendario.
--
-- Cuatro categorías:
--   * fiesta_19_dias            — Fiestas (sembradas por migración 015)
--   * dia_sagrado_no_trabajo    — Días Sagrados con suspensión de trabajo
--   * dia_sagrado_con_trabajo   — Días Sagrados sin suspensión de trabajo
--   * actividad_general         — Cualquier otro evento (default)
--
-- Esta migración solo agrega la columna y el constraint. Las siembras
-- automáticas (Fiestas y Días Sagrados) vienen en migraciones 014 y 015.
-- ═════════════════════════════════════════════════════════════════

alter table public.calendar_events
  add column if not exists kind text not null default 'actividad_general'
  check (
    kind in (
      'fiesta_19_dias',
      'dia_sagrado_no_trabajo',
      'dia_sagrado_con_trabajo',
      'actividad_general'
    )
  );

create index if not exists calendar_events_kind_idx
  on public.calendar_events (kind);
