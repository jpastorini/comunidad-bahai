-- 071 · Chat: "recibido" (el doble check)
--
-- Los tres estados de cada mensaje, como en WhatsApp:
--   ✓   enviado  → la fila existe.
--   ✓✓  recibido → `delivered_at`: llegó al teléfono de quien lo recibe.
--   ✓✓  leído    → ya existía: `read` (la Secretaría o el tesorero abrió
--                  la conversación) para lo que manda el creyente, y
--                  `read_by_member` (010) para las respuestas.
--
-- "Recibido" se anota por tres caminos, cualquiera alcanza:
--   · el service worker recibió el push (worker/index.js → /api/chat/delivered);
--   · la app de quien recibe estaba abierta y le llegó por Realtime
--     (ChatNotifier);
--   · la persona abrió la app, en cualquier pantalla (ChatNotifier al montar
--     y al volver al frente).
--
-- Va por RPC y no por UPDATE directo por la misma razón que mark_chat_seen
-- (045): la RLS no acota columnas, y darle UPDATE al creyente sobre sus
-- filas le dejaría tocar `read` o el texto.
--
-- Run once in the Supabase SQL Editor.

alter table public.chat_messages
  add column if not exists delivered_at timestamptz;

comment on column public.chat_messages.delivered_at is
  'Cuándo llegó al dispositivo de quien lo recibe (push o app abierta). NULL = enviado y todavía no recibido. Lo escribe solo mark_chat_delivered().';

-- Lo que ya se leyó, obviamente llegó. Lo demás queda en "enviado" hasta
-- que quien lo recibe abra la app.
update public.chat_messages
set delivered_at = created_at
where delivered_at is null
  and ((is_admin_reply and read_by_member) or (not is_admin_reply and read));

-- La RPC corre en cada apertura de la app: que busque solo lo pendiente.
create index if not exists chat_messages_undelivered_idx
  on public.chat_messages (member_id, topic)
  where delivered_at is null;

-- ── RPC ───────────────────────────────────────────────────────────
--
-- Marca como recibido lo que le llegó a quien llama, en sus dos papeles:
--   · como creyente, las respuestas de su propia conversación;
--   · como quien atiende un canal, lo que le escribieron a ese canal en
--     las comunidades donde tiene el tag. Por MEMBRESÍA (056), no por el
--     sombrero puesto: el push le llega a quien tiene el tag en esa
--     comunidad (getChatAdminIds), aunque ande con el sombrero de otra.
-- p_topic y p_member_id acotan (el push dice de qué conversación es);
-- NULL = todo lo pendiente.

create or replace function public.mark_chat_delivered(
  p_topic text default null,
  p_member_id uuid default null
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
  if p_topic is not null and p_topic not in ('secretaria', 'tesoreria') then
    return;
  end if;

  update public.chat_messages
  set delivered_at = now()
  where member_id = auth.uid()
    and is_admin_reply = true
    and delivered_at is null
    and (p_topic is null or topic = p_topic);

  update public.chat_messages c
  set delivered_at = now()
  where c.is_admin_reply = false
    and c.delivered_at is null
    and c.from_user_id <> auth.uid()
    and (p_topic is null or c.topic = p_topic)
    and (p_member_id is null or c.member_id = p_member_id)
    and exists (
      select 1
      from public.profile_localities pl
      where pl.profile_id = auth.uid()
        and pl.locality_id = c.locality_id
        and (
          (c.topic = 'secretaria' and pl.can_respond_chat)
          or (c.topic = 'tesoreria' and pl.can_manage_treasury)
        )
    );
end;
$$;

grant execute on function public.mark_chat_delivered(text, uuid) to authenticated;
