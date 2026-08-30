"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { chatFailure } from "@/lib/chat-errors";
import { getChatAdminIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CHAT_TOPIC_ADMIN_PATHS,
  CHAT_TOPIC_PATHS,
  type ChatTopic,
} from "@/lib/types";

/** Resultado de enviar: la pantalla necesita saber si el mensaje quedó. */
export type SendResult = { ok: true } | { ok: false; message: string };

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
 *
 * Si falla no se le dice nada a la persona —lo único que queda mal es un
 * indicador de aviso— pero sí queda en los logs.
 */
export async function markChatSeenAction(topic: ChatTopic) {
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc("mark_chat_seen", { p_topic: topic });
  chatFailure(`mark_chat_seen(${topic})`, error, "");
  revalidatePath("/");
  revalidatePath(CHAT_TOPIC_PATHS[topic]);
}

export async function sendMemberMessageAction(
  formData: FormData
): Promise<SendResult> {
  const topic = parseTopic(formData.get("topic"));
  const path = CHAT_TOPIC_PATHS[topic];

  const session = await requireMember(path);
  const text = (formData.get("text") as string)?.trim();
  if (!text) return { ok: false, message: "Escribí un mensaje antes de enviar." };

  const supabase = createSupabaseServer();
  // El error del insert se mira SIEMPRE: si no, el action termina bien, la
  // burbuja optimista se queda en pantalla y la persona cree que mandó un
  // mensaje que nunca se guardó.
  const { error } = await supabase.from("chat_messages").insert({
    member_id: session.user.id,
    from_user_id: session.user.id,
    text,
    is_admin_reply: false,
    topic,
  });
  const failure = chatFailure(
    `insert(${topic})`,
    error,
    "No pudimos enviar el mensaje. Probá de nuevo en un momento."
  );
  if (failure) return { ok: false, message: failure };

  // Push a quien atiende el canal: la Secretaría (tag de chat) o el
  // tesorero (tag de tesorería), siempre de la misma localidad. Si el push
  // falla no se deshace nada: el mensaje ya está guardado, que es lo que
  // importa (sendPushToUsers nunca lanza).
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
  return { ok: true };
}
