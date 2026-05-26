"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getChatAdminIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Marca todas las respuestas de la Secretaría dirigidas a este miembro
 * como leídas. Se invoca al abrir /chat para apagar el indicador "!"
 * del home.
 */
export async function markChatSeenByMemberAction(memberId: string) {
  const supabase = createSupabaseServer();
  await supabase
    .from("chat_messages")
    .update({ read_by_member: true })
    .eq("member_id", memberId)
    .eq("is_admin_reply", true)
    .eq("read_by_member", false);
  revalidatePath("/");
  revalidatePath("/chat");
}

export async function sendMemberMessageAction(formData: FormData) {
  const session = await requireMember("/chat");
  const text = (formData.get("text") as string)?.trim();
  if (!text) redirect("/chat");

  const supabase = createSupabaseServer();
  await supabase.from("chat_messages").insert({
    member_id: session.user.id,
    from_user_id: session.user.id,
    text,
    is_admin_reply: false,
  });

  // Push a la Secretaría (admins con tag de chat de la localidad).
  const adminIds = await getChatAdminIds(session.locality.id, session.user.id);
  await sendPushToUsers(adminIds, {
    title: "Nuevo mensaje de chat",
    body: text.slice(0, 120),
    url: `/admin/chat/${session.user.id}`,
    tag: `chat-${session.user.id}`,
  });

  revalidatePath("/chat");
}
