-- Permite saber, desde la perspectiva del miembro, qué respuestas de la
-- Secretaría aún no ha visto. Distinto de `read` (que es la perspectiva
-- de la Secretaría sobre mensajes entrantes).
--
-- Se marca como true cuando el miembro abre la conversación.
--
-- Run once in the Supabase SQL Editor.

alter table public.chat_messages
  add column if not exists read_by_member boolean not null default false;

-- Backfill: damos por leídas las respuestas existentes para no inflar
-- el indicador la primera vez que cada miembro entre.
update public.chat_messages
set read_by_member = true
where is_admin_reply = true;
