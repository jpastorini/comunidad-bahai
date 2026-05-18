-- Calendar events: agregar descripción, imagen de invitación, ubicación
-- y duración (para generar .ics descargable).
--
-- Reusa el bucket 'comunicados' para las imágenes ya que sus políticas
-- ya están listas y el uso es el mismo (lectura pública, escritura admin).
--
-- Run once in the Supabase SQL Editor.

alter table public.calendar_events
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists location text,
  add column if not exists duration_minutes int not null default 60;
