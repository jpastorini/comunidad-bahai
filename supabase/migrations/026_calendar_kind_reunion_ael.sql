-- ═════════════════════════════════════════════════════════════════
-- Nuevo tipo de evento de calendario: "Reunión AEL".
--
-- Amplía el check constraint de calendar_events.kind (migración 013)
-- para aceptar 'reunion_ael', un evento manual que la Asamblea crea
-- para sus reuniones. Visible para todos los miembros de la localidad
-- (misma RLS que el resto de los eventos).
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

alter table public.calendar_events
  drop constraint if exists calendar_events_kind_check;

alter table public.calendar_events
  add constraint calendar_events_kind_check
  check (
    kind in (
      'fiesta_19_dias',
      'dia_sagrado_no_trabajo',
      'dia_sagrado_con_trabajo',
      'reunion_ael',
      'actividad_general'
    )
  );
