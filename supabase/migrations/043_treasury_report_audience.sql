-- ═════════════════════════════════════════════════════════════════
-- Informes de Tesorería: dos destinatarios, dos formatos.
--
-- Hasta ahora todo informe era para la comunidad: un deck de
-- diapositivas que se proyecta en la Fiesta y se comparte por link
-- público. La Asamblea necesita otra cosa: una HOJA condensada, sin
-- gráficos, para adjuntar al acta y aprobar en reunión.
--
-- `audience` distingue los dos y NO es solo cosmético: define quién
-- puede leer el informe.
--
--   'comunidad' — deck. Lo lee cualquier creyente de la localidad
--                 cuando está publicado, y se comparte por /i/<token>.
--   'internos'  — hoja para el acta. La leen los miembros de la
--                 Asamblea (rol admin) y el tesorero. NO se resuelve
--                 por el link público, ni la ve un creyente.
--
-- Ninguno de los dos lleva nombres de contribuyentes: eso sigue siendo
-- exclusivo del libro. La diferencia no es confidencialidad de personas
-- sino de destinatario — el interno tiene el detalle administrativo
-- (conciliación, movimientos internos, pendientes) que a la comunidad no
-- le dice nada.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

alter table public.treasury_reports
  add column if not exists audience text not null default 'comunidad'
    check (audience in ('comunidad', 'internos'));

-- El índice de la lista del panel separa por destinatario.
drop index if exists treasury_reports_locality_idx;
create index if not exists treasury_reports_locality_idx
  on public.treasury_reports (locality_id, audience, status, period_to desc);

-- ─── Lectura, ahora por destinatario ─────────────────────────────
--
-- Cuatro caminos, en orden de amplitud:
--   1. Informe de comunidad publicado → cualquier creyente de la
--      localidad.
--   2. Informe interno publicado → miembros de la Asamblea (rol admin)
--      de la localidad. Los borradores no: un informe interno se lee
--      cuando el tesorero lo emitió.
--   3. Cualquier informe de la localidad → el tesorero.
--   4. Admin nacional → todo, solo lectura.
drop policy if exists treasury_reports_select on public.treasury_reports;
create policy treasury_reports_select on public.treasury_reports
  for select to authenticated
  using (
    (
      status = 'published'
      and audience = 'comunidad'
      and locality_id = public.current_locality_id()
    )
    or (
      status = 'published'
      and audience = 'internos'
      and public.is_admin(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or (
      public.has_treasury_tag(auth.uid())
      and locality_id = public.current_locality_id()
    )
    or public.is_national_admin(auth.uid())
  );

-- La escritura no cambia: sigue siendo solo del tesorero (política
-- treasury_reports_tag_write de la migración 041).
--
-- ⚠️ El link público (/i/<token>) se resuelve con la service-role key,
-- que ignora la RLS. El filtro por audience = 'comunidad' está en
-- `getPublicReport()` (lib/treasury-reports.ts): si alguien toca esa
-- función, un informe interno se vuelve público.
