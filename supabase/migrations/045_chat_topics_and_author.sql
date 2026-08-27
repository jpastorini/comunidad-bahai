-- ═════════════════════════════════════════════════════════════════
-- Chat: dos canales (Secretaría / Tesorería) y autor visible.
--
-- 1. `topic` — la conversación deja de ser una por creyente y pasa a ser
--    una por (creyente, tema). El tesorero atiende su propio canal: mucha
--    gente aporta al Fondo con un giro directo a la cuenta y necesita
--    avisarle. Quién lee y quién responde cada tema lo decide el TAG, no
--    el rol: `can_respond_chat` para 'secretaria', `can_manage_treasury`
--    para 'tesoreria'. Un miembro de la Asamblea con tag de chat NO lee
--    los mensajes al tesorero, ni por API directa — misma regla de
--    confidencialidad que el libro contable.
--
-- 2. `from_name` — el nombre de quien responde, congelado en el asiento.
--    El creyente veía "Secretaría Local" sin autor. Se denormaliza (en
--    vez de join a profiles) por dos razones: el payload de Realtime
--    llega con la fila y nada más, y un creyente no lee el perfil de
--    quien le contesta. Además queda el registro histórico de quién
--    respondió esa vez, que es lo que corresponde.
--
-- Idempotente. Run once in the Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════

-- ── Columnas ──────────────────────────────────────────────────────

alter table public.chat_messages
  add column if not exists topic text not null default 'secretaria';

alter table public.chat_messages
  drop constraint if exists chat_messages_topic_check;
alter table public.chat_messages
  add constraint chat_messages_topic_check
  check (topic in ('secretaria', 'tesoreria'));

alter table public.chat_messages
  add column if not exists from_name text;

-- Backfill: nombre actual de quien respondió. Desde acá en adelante lo
-- escribe el server action al insertar.
update public.chat_messages cm
set from_name = p.full_name
from public.profiles p
where p.id = cm.from_user_id
  and cm.is_admin_reply = true
  and cm.from_name is null
  and p.full_name is not null;

-- El índice de la bandeja: las consultas siempre son por conversación,
-- que ahora es (miembro, tema).
create index if not exists chat_messages_member_topic_idx
  on public.chat_messages (member_id, topic, created_at);

-- ── RLS ───────────────────────────────────────────────────────────

-- El creyente lee su propia conversación, los dos temas.
-- (`chat_select_own` no cambia; se recrea por claridad.)
drop policy if exists "chat_select_own" on public.chat_messages;
create policy "chat_select_own" on public.chat_messages
  for select using (member_id = auth.uid());

-- Quien atiende lee SOLO el tema de su tag, y solo en su localidad.
drop policy if exists "chat_select_admin_tag" on public.chat_messages;
create policy "chat_select_admin_tag" on public.chat_messages
  for select using (
    locality_id = public.current_locality_id()
    and (
      (topic = 'secretaria' and public.has_chat_tag(auth.uid()))
      or (topic = 'tesoreria' and public.has_treasury_tag(auth.uid()))
    )
  );

-- El creyente escribe en su propia conversación, en cualquiera de los dos
-- temas. `is_admin_reply` y `from_name` son la identidad de quien
-- atiende: un mensaje entrante no los pone (si no, se podría fabricar una
-- respuesta firmada por otra persona).
drop policy if exists "chat_insert_member" on public.chat_messages;
create policy "chat_insert_member" on public.chat_messages
  for insert with check (
    member_id = auth.uid()
    and from_user_id = auth.uid()
    and is_admin_reply = false
    and from_name is null
  );

drop policy if exists "chat_insert_admin_tag" on public.chat_messages;
create policy "chat_insert_admin_tag" on public.chat_messages
  for insert with check (
    from_user_id = auth.uid()
    and locality_id = public.current_locality_id()
    and (
      (topic = 'secretaria' and public.has_chat_tag(auth.uid()))
      or (topic = 'tesoreria' and public.has_treasury_tag(auth.uid()))
    )
  );

-- Marcar leído (los dos flags). Cada uno en su tema.
drop policy if exists "chat_update_admin_tag" on public.chat_messages;
create policy "chat_update_admin_tag" on public.chat_messages
  for update using (
    locality_id = public.current_locality_id()
    and (
      (topic = 'secretaria' and public.has_chat_tag(auth.uid()))
      or (topic = 'tesoreria' and public.has_treasury_tag(auth.uid()))
    )
  )
  with check (
    locality_id = public.current_locality_id()
    and (
      (topic = 'secretaria' and public.has_chat_tag(auth.uid()))
      or (topic = 'tesoreria' and public.has_treasury_tag(auth.uid()))
    )
  );

-- ── RPC: el creyente marca como vistas las respuestas ─────────────
--
-- No va por policy de UPDATE: la RLS no acota columnas, así que dejar al
-- creyente escribir en sus propias filas le permitiría también tocar
-- `read` (y esconderle mensajes sin leer a quien atiende) o el propio
-- texto. Esta función escribe UNA columna y nada más.
--
-- Ojo que antes de esta migración el UPDATE del creyente no pasaba
-- ninguna policy (la única de update exigía tag de chat), así que el
-- indicador "!" del home no se apagaba nunca para un creyente común.

create or replace function public.mark_chat_seen(
  p_topic text default 'secretaria'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_topic not in ('secretaria', 'tesoreria') then
    return;
  end if;

  update public.chat_messages
  set read_by_member = true
  where member_id = auth.uid()
    and topic = p_topic
    and is_admin_reply = true
    and read_by_member = false;
end;
$$;

grant execute on function public.mark_chat_seen(text) to authenticated;

-- ── RPC: resúmenes de conversación, por tema ──────────────────────
--
-- La firma cambia: recibe el tema. Hay que DROPear la vieja sin
-- parámetros, porque con un default la llamada sin argumentos quedaría
-- ambigua entre las dos.

drop function if exists public.get_chat_conversation_summaries();
drop function if exists public.get_chat_conversation_summaries(text);

create or replace function public.get_chat_conversation_summaries(
  p_topic text default 'secretaria'
)
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
  v_ok  boolean;
begin
  -- Cada tema exige su propio tag. security definer, así que el guard es
  -- lo único que separa la bandeja de la Secretaría de la del tesorero.
  v_ok := case p_topic
    when 'secretaria' then public.has_chat_tag(auth.uid())
    when 'tesoreria'  then public.has_treasury_tag(auth.uid())
    else false
  end;
  if not coalesce(v_ok, false) then
    return;
  end if;

  return query
  with last_msg as (
    select distinct on (cm.member_id)
      cm.member_id, cm.text, cm.created_at
    from public.chat_messages cm
    where cm.locality_id = v_loc
      and cm.topic = p_topic
    order by cm.member_id, cm.created_at desc
  ),
  unread_counts as (
    select cm.member_id, count(*)::bigint as unread
    from public.chat_messages cm
    where cm.locality_id = v_loc
      and cm.topic = p_topic
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

grant execute on function public.get_chat_conversation_summaries(text) to authenticated;
