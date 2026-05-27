-- ═════════════════════════════════════════════════════════════════
-- Recordatorios de eventos (push 1 día antes).
--
-- Marca el momento en que se envió el recordatorio de un evento para no
-- volver a notificarlo en cada corrida del cron diario. Cada evento es una
-- fecha concreta (no recurre), así que con una columna por fila alcanza.
-- NULL = todavía no se notificó.
-- ═════════════════════════════════════════════════════════════════

alter table public.calendar_events
  add column if not exists reminder_sent_at timestamptz;
