-- Permitir que el admin capture sugerencias recogidas verbalmente o en
-- papel durante la Fiesta, atribuyéndolas al autor sin necesitar cuenta.
--
-- - user_id sigue siendo el campo principal para sugerencias enviadas
--   por miembros logueados (autenticadas).
-- - author_name es texto libre para capturas manuales por la Asamblea.
--   Si user_id y author_name son ambos NULL, la sugerencia es anónima.
--
-- Run once in the Supabase SQL Editor.

alter table public.feast_suggestions
  add column if not exists author_name text;
