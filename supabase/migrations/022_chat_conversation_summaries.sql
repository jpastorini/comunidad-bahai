-- ═════════════════════════════════════════════════════════════════
-- RPC: resúmenes de conversación para la bandeja de la Secretaría.
--
-- Antes el panel de chat traía TODOS los chat_messages y los agrupaba
-- por miembro en memoria (+ una 2ª query de perfiles). Esta función
-- hace la agregación en SQL: una fila por miembro con el último mensaje
-- y la cantidad de mensajes entrantes sin leer.
--
-- Aislamiento por localidad: solo conversaciones de la localidad del
-- usuario que llama, y solo si tiene el tag de chat (has_chat_tag).
-- security definer para poder resolver nombres/emails en profiles, pero
-- los dos guards de arriba acotan estrictamente lo que devuelve.
--
-- Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

create or replace function public.get_chat_conversation_summaries()
returns table (
  member_id uuid,
  member_name text,
  member_email text,
  last_text text,
  last_at timestamptz,
  unread bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_loc uuid := public.current_locality_id();
begin
  -- Solo admins con tag de chat pueden ver la bandeja.
  if not public.has_chat_tag(auth.uid()) then
    return;
  end if;

  return query
  with last_msg as (
    select distinct on (cm.member_id)
      cm.member_id, cm.text, cm.created_at
    from public.chat_messages cm
    where cm.locality_id = v_loc
    order by cm.member_id, cm.created_at desc
  ),
  unread_counts as (
    select cm.member_id, count(*)::bigint as unread
    from public.chat_messages cm
    where cm.locality_id = v_loc
      and cm.is_admin_reply = false
      and cm.read = false
    group by cm.member_id
  )
  select
    lm.member_id,
    coalesce(p.full_name, 'Sin nombre') as member_name,
    coalesce(p.email, '')              as member_email,
    lm.text                            as last_text,
    lm.created_at                      as last_at,
    coalesce(uc.unread, 0)             as unread
  from last_msg lm
  left join public.profiles p   on p.id = lm.member_id
  left join unread_counts uc    on uc.member_id = lm.member_id
  order by lm.created_at desc
  limit 100;
end;
$$;

grant execute on function public.get_chat_conversation_summaries() to authenticated;
