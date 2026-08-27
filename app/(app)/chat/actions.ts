"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getChatAdminIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CHAT_TOPIC_ADMIN_PATHS,
  CHAT_TOPIC_PATHS,
  type ChatTopic,
} from "@/lib/types";

function parseTopic(value: unknown): ChatTopic {
  return value === "tesoreria" ? "tesoreria" : "secretaria";
}

/**
 * Marca como leídas las respuestas dirigidas a este creyente en un canal.
 * Se invoca al abrir el chat para apagar el indicador "!" del home.
 *
 * Va por RPC (`mark_chat_seen`, migración 045) y no por UPDATE directo:
 * la RLS no acota columnas, así que darle permiso de escritura al creyente
 * sobre sus propias filas le permitiría también tocar `read` o el texto.
 * Es por tema: abrir Secretaría no apaga el aviso de Tesorería.
 */
export async function markChatSeenAction(topic: ChatTopic) {
  const supabase = createSupabaseServer();
  await supabase.rpc("mark_chat_seen", { p_topic: topic });
  revalidatePath("/");
  revalidatePath(CHAT_TOPIC_PATHS[topic]);
}

export async function sendMemberMessageAction(formData: FormData) {
  const topic = parseTopic(formData.get("topic"));
  const path = CHAT_TOPIC_PATHS[topic];

  const session = await requireMember(path);
  const text = (formData.get("text") as string)?.trim();
  if (!text) redirect(path);

  const supabase = createSupabaseServer();
  await supabase.from("chat_messages").insert({
    member_id: session.user.id,
    from_user_id: session.user.id,
    text,
    is_admin_reply: false,
    topic,
  });

  // Push a quien atiende el canal: la Secretaría (tag de chat) o el
  // tesorero (tag de tesorería), siempre de la misma localidad.
  const adminIds = await getChatAdminIds(
    session.locality.id,
    session.user.id,
    topic
  );
  await sendPushToUsers(adminIds, {
    title:
      topic === "tesoreria"
        ? "Nuevo mensaje para Tesorería"
        : "Nuevo mensaje de chat",
    body: text.slice(0, 120),
    url: `${CHAT_TOPIC_ADMIN_PATHS[topic]}/${session.user.id}`,
    tag: `chat-${topic}-${session.user.id}`,
  });

  revalidatePath(path);
}
