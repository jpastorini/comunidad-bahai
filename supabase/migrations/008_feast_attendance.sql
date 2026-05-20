-- Estadística de participación en cada celebración de la Fiesta de
-- los Diecinueve Días. Se registra por ubicación porque cada ubicación
-- es una reunión independiente; el total por Fiesta se calcula sumando.
--
-- Nullable a propósito: se rellena después de la Fiesta. NULL = "aún
-- sin registrar" (distinto de 0 = "no asistió nadie").
--
-- Run once in the Supabase SQL Editor.

alter table public.feast_locations
  add column if not exists participant_count int
    check (participant_count is null or participant_count >= 0);
