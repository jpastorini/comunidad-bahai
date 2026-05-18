-- Distinguish messages from the Universal House of Justice from
-- announcements posted by the Local Spiritual Assembly.
--
-- Run once in the Supabase SQL Editor.

alter table public.messages
  add column if not exists source text not null default 'casa_universal'
  check (source in ('casa_universal', 'asamblea_local'));

create index if not exists messages_source_date_idx
  on public.messages (source, date desc);
