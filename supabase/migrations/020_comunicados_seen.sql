-- ═════════════════════════════════════════════════════════════════
-- Comunicados: rastreo de lectura por usuario.
--
-- Hasta ahora los comunicados (messages con source='asamblea_local')
-- solo tenían un flag global `is_new`, sin estado per-usuario. Esta
-- columna guarda la última vez que cada miembro abrió la sección de
-- Comunicados; comparándola con el `created_at` del comunicado más
-- reciente sabemos si tiene algo sin leer (igual idea que el chat).
--
-- La política RLS existente `profiles_update_self` ya permite que cada
-- usuario actualice su propia fila, así que no hace falta tocar policies.
-- ═════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists comunicados_seen_at timestamptz;
