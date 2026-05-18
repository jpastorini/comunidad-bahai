-- Distinguish admin/secretariat replies from member messages even when
-- the same user happens to send both (typical during testing).
--
-- Run once in the Supabase SQL Editor.

alter table public.chat_messages
  add column if not exists is_admin_reply boolean not null default false;

-- Backfill existing rows: any message whose sender has the chat tag is
-- treated as an admin reply. This keeps historical messages displayed
-- correctly after the migration.
update public.chat_messages cm
set is_admin_reply = true
from public.profiles p
where p.id = cm.from_user_id
  and p.can_respond_chat = true
  and cm.from_user_id <> cm.member_id;
