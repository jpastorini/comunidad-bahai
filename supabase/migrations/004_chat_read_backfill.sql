-- Backfill: marca como "leídas" todas las respuestas del admin que
-- quedaron con read=false bajo la lógica anterior. Solo los mensajes
-- entrantes de miembros deben contar como "sin leer" en los contadores.
--
-- Run once after deploying the chat read-counter fix.

update public.chat_messages
set read = true
where is_admin_reply = true
  and read = false;
