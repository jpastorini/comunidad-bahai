-- ═════════════════════════════════════════════════════════════════
-- Habilita Supabase Realtime para chat_messages.
--
-- Las notificaciones de chat (sonido + badge en vivo + el listener
-- global ChatNotifier) y el chat en vivo dependen de eventos
-- `postgres_changes`. Para que el servidor los emita, la tabla debe
-- estar en la publicación `supabase_realtime`. Si no se habilitó nunca
-- (desde el dashboard o por migración), NO llega ningún evento.
--
-- REPLICA IDENTITY FULL permite que las políticas RLS evalúen la fila
-- completa en los eventos de realtime (necesario para UPDATE/DELETE y
-- más robusto en general).
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

alter table public.chat_messages replica identity full;
