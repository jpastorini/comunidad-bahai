"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureChatTag,
  ensureTreasuryTag,
  requireAdmin,
  type AdminSession,
} from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
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
 * Cada canal exige SU tag: la Secretaría no lee ni contesta los mensajes
 * dirigidos al tesorero, y viceversa. La RLS de `chat_messages` aplica la
 * misma regla en la base (migración 045); esto es el guard de la pantalla.
 */
async function requireTopicAccess(topic: ChatTopic): Promise<AdminSession> {
  const session = await requireAdmin();
  if (topic === "tesoreria") ensureTreasuryTag(session.profile);
  else ensureChatTag(session.profile);
  return session;
}

export async function sendChatReplyAction(formData: FormData) {
  const topic = parseTopic(formData.get("topic"));
  const session = await requireTopicAccess(topic);

  const memberId = formData.get("member_id") as string;
  const text = (formData.get("text") as string)?.trim();
  const basePath = CHAT_TOPIC_ADMIN_PATHS[topic];
  if (!memberId || !text) {
    redirect(`${basePath}/${memberId}?error=empty`);
  }

  const supabase = createSupabaseServer();
  await supabase.from("chat_messages").insert({
    member_id: memberId,
    from_user_id: session.user.id,
    text,
    is_admin_reply: true,
    topic,
    // El creyente tiene derecho a saber quién le contesta. Se guarda el
    // nombre acá (y no se resuelve al leer) porque el payload de Realtime
    // llega con la fila y nada más, y porque un creyente no lee el perfil
    // de quien atiende. Ver migración 045.
    from_name: session.profile.full_name,
    // Las respuestas se consideran "leídas" de inmediato: el flag `read`
    // solo aplica a mensajes entrantes que esperan respuesta.
    read: true,
  });

  // Push al creyente (a menos que sea uno mismo en pruebas).
  if (memberId !== session.user.id) {
    await sendPushToUsers([memberId], {
      title:
        topic === "tesoreria"
          ? "Tesorería"
          : "Secretaría Local",
      body: text.slice(0, 120),
      url: CHAT_TOPIC_PATHS[topic],
      tag: `chat-${topic}-${memberId}`,
    });
  }

  revalidatePath(`${basePath}/${memberId}`);
  revalidatePath(basePath);
  revalidatePath("/admin");
  redirect(`${basePath}/${memberId}`);
}

export async function markConversationReadAction(
  memberId: string,
  topic: ChatTopic
) {
  await requireTopicAccess(topic);
  const supabase = createSupabaseServer();
  // Solo los mensajes ENTRANTES (del creyente, no las respuestas) se
  // marcan como leídos al abrir la conversación. Usamos is_admin_reply en
  // vez de from_user_id porque admin y creyente pueden ser el mismo
  // usuario en pruebas/self-test.
  await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("member_id", memberId)
    .eq("topic", topic)
    .eq("is_admin_reply", false)
    .eq("read", false);

  const basePath = CHAT_TOPIC_ADMIN_PATHS[topic];
  revalidatePath(`${basePath}/${memberId}`);
  revalidatePath(basePath);
  revalidatePath("/admin");
}
