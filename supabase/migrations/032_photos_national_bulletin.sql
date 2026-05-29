-- ═════════════════════════════════════════════════════════════════
-- Fase 2 de fotos: Boletín Nacional
--
-- Hasta ahora un miembro solo veía las fotos de SU localidad. El boletín
-- nacional muestra fotos marcadas `visibility = 'national'` de TODAS las
-- comunidades. Para eso ampliamos la policy de select: además de las de
-- la propia localidad (y del admin nacional, que ve todo), cualquier
-- miembro autenticado puede ver las fotos nacionales de cualquier lado.
--
-- Las columnas `visibility` y `featured` ya existen desde 017_event_photos.
-- El admin local marca/desmarca destacadas y nacionales vía server actions
-- (la policy update_admin de 017 ya lo permite).
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

drop policy if exists "event_photos_select_locality" on public.event_photos;
create policy "event_photos_select_locality" on public.event_photos
  for select using (
    locality_id = public.current_locality_id()
    or visibility = 'national'
    or public.is_national_admin(auth.uid())
  );

-- Índice para listar el boletín (fotos nacionales más recientes primero).
create index if not exists event_photos_national_created_idx
  on public.event_photos (created_at desc)
  where visibility = 'national';

-- ─── Título del evento denormalizado ─────────────────────────────
-- El boletín muestra fotos de OTRAS localidades, pero la RLS de
-- calendar_events/feasts filtra por la localidad propia, así que un
-- miembro no puede resolver el título del evento ajeno. Igual que con
-- `uploader_name`, guardamos un snapshot del título en la foto.
alter table public.event_photos
  add column if not exists event_title text;

-- Backfill (corre como postgres en el SQL Editor, sin RLS de por medio).
update public.event_photos ep
set event_title = ce.title
from public.calendar_events ce
where ep.event_type = 'calendar'
  and ep.event_id = ce.id
  and ep.event_title is null;

update public.event_photos ep
set event_title = 'Fiesta de ' || f.bahai_month_name
from public.feasts f
where ep.event_type = 'feast'
  and ep.event_id = f.id
  and ep.event_title is null;
