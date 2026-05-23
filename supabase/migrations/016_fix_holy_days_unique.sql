-- ═════════════════════════════════════════════════════════════════
-- Fix de la migración 015.
--
-- El upsert de supabase-js requiere que el `onConflict` apunte a un
-- constraint o índice único NO parcial. La migración 015 creó un
-- índice único parcial (`WHERE system_id IS NOT NULL`) y eso causó:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Reemplazamos por un constraint único normal. En PostgreSQL, los
-- valores NULL en un UNIQUE son distintos entre sí por default, así
-- que los eventos creados a mano (system_id IS NULL) siguen pudiendo
-- coexistir sin conflicto.
-- ═════════════════════════════════════════════════════════════════

drop index if exists public.calendar_events_system_id_unique;

alter table public.calendar_events
  drop constraint if exists calendar_events_locality_system_id_unique;

alter table public.calendar_events
  add constraint calendar_events_locality_system_id_unique
  unique (locality_id, system_id);
