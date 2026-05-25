-- ═════════════════════════════════════════════════════════════════
-- Contenido a nivel NACIONAL (compartido entre todas las localidades).
--
-- Algunas cosas no son de una comunidad sino de todo el sistema:
--   • Mensajes de la Casa Universal de Justicia  → siempre nacionales
--   • Materiales de estudio (currículo, Libros)    → nacionales o locales
--
-- Modelo: una fila con `locality_id IS NULL` = NACIONAL, visible para
-- TODAS las localidades (una sola fuente de verdad; el Admin Nacional la
-- edita y todas las comunidades la ven actualizada). No se duplica nada.
--
-- Se quitan los triggers de auto-locality en estas dos tablas: cada
-- server action setea `locality_id` explícito (local = su localidad,
-- nacional = NULL). Las tablas siempre-locales (fiestas, chat, calendario,
-- tesorería, actividades, servicio, comunicados) NO se tocan.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ─── messages ────────────────────────────────────────────────────
alter table public.messages alter column locality_id drop not null;

-- Casa Universal → nacional. Comunicados (asamblea_local) quedan locales.
-- Defensivo: solo si la columna `source` existe (migración 002). Si no
-- existe, no hay distinción Casa Universal/Asamblea aún y se omite.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'source'
  ) then
    update public.messages set locality_id = null where source = 'casa_universal';
  end if;
end $$;

drop trigger if exists messages_set_locality on public.messages;

drop policy if exists "messages_select_locality" on public.messages;
drop policy if exists "messages_select_scope" on public.messages;
create policy "messages_select_scope" on public.messages
  for select using (
    locality_id is null
    or locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "messages_admin_write" on public.messages;
create policy "messages_admin_write" on public.messages
  for all
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
  );

-- ─── study_materials ─────────────────────────────────────────────
alter table public.study_materials alter column locality_id drop not null;

-- Nuevo kind 'libros' (categoría dentro de Materiales).
alter table public.study_materials drop constraint if exists study_materials_kind_check;
alter table public.study_materials add constraint study_materials_kind_check
  check (kind in ('ruhi', 'escritos', 'oraciones', 'oracion_del_mes', 'libros'));

drop trigger if exists study_materials_set_locality on public.study_materials;

drop policy if exists "study_materials_select_locality" on public.study_materials;
drop policy if exists "study_materials_select_scope" on public.study_materials;
create policy "study_materials_select_scope" on public.study_materials
  for select using (
    locality_id is null
    or locality_id = public.current_locality_id()
    or public.is_national_admin(auth.uid())
  );

drop policy if exists "study_materials_admin_write" on public.study_materials;
create policy "study_materials_admin_write" on public.study_materials
  for all
  using (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
  )
  with check (
    (public.is_admin(auth.uid()) and locality_id = public.current_locality_id())
    or (public.is_national_admin(auth.uid()) and locality_id is null)
  );
