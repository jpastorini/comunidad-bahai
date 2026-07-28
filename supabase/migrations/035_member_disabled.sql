-- ═════════════════════════════════════════════════════════════════
-- Deshabilitar miembros (soft-disable).
--
-- La Asamblea Local puede desactivar el acceso de un miembro sin borrar
-- su perfil ni el historial asociado (chat, fotos, asistencia a Fiestas,
-- disponibilidad, etc.). Es reversible: basta con limpiar disabled_at.
--
--   disabled_at  NULL  → activo
--   disabled_at  fecha → deshabilitado; el middleware lo redirige a
--                        /cuenta-deshabilitada y le corta el acceso.
--
-- El bloqueo se hace en la capa de aplicación (middleware.ts) — no en RLS —
-- porque un miembro deshabilitado debe seguir pudiendo leer su propio
-- perfil para ver la pantalla de aviso.
-- ═════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id) on delete set null;

-- Índice parcial: la mayoría de los perfiles están activos, solo nos
-- interesa filtrar/listar los deshabilitados.
create index if not exists profiles_disabled_idx
  on public.profiles (locality_id)
  where disabled_at is not null;
