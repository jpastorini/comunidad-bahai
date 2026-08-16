-- ═════════════════════════════════════════════════════════════════
-- Recordatorios devocionales personales.
--
-- 1. prayer_reminder_enabled — aviso diario de la Oración Obligatoria
--    corta, a las 13:00 hora local de la comunidad. Arranca APAGADO:
--    es una práctica personal, nadie debería recibirlo sin pedirlo.
--    Se ofrece en el asistente de bienvenida, en el perfil y en la
--    propia pantalla de la oración.
--
-- 2. daily_quote_push_enabled — aviso de las 8:00 con la "Lectura de
--    hoy" (cita de los Escritos Sagrados). Arranca PRENDIDO: es
--    contenido de la comunidad, equivalente a un comunicado diario, y
--    de todos modos solo llega a quien ya aceptó notificaciones push.
--    Se puede apagar desde el perfil.
--
-- La política RLS existente `profiles_update_self` ya permite que cada
-- usuario actualice su propia fila, así que no hace falta tocar policies.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists prayer_reminder_enabled boolean not null default false;

alter table public.profiles
  add column if not exists daily_quote_push_enabled boolean not null default true;

-- Índice parcial: el cron de las 13:00 solo busca a quienes lo prendieron.
create index if not exists profiles_prayer_reminder_idx
  on public.profiles (id)
  where prayer_reminder_enabled;
