"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function sendChatReplyAction(formData: FormData) {
  const session = await requireAdmin();
  ensureChatTag(session.profile);

  const memberId = formData.get("member_id") as string;
  const text = (formData.get("text") as string)?.trim();
  if (!memberId || !text) {
    redirect(`/admin/chat/${memberId}?error=empty`);
  }

  const supabase = createSupabaseServer();
  await supabase.from("chat_messages").insert({
    member_id: memberId,
    from_user_id: session.user.id,
    text,
    is_admin_reply: true,
    // Las respuestas de la Secretaría se consideran "leídas" de inmediato:
    // el flag `read` solo aplica a mensajes entrantes que esperan respuesta.
    read: true,
  });

  revalidatePath(`/admin/chat/${memberId}`);
  revalidatePath("/admin/chat");
  revalidatePath("/admin");
  redirect(`/admin/chat/${memberId}`);
}

export async function markConversationReadAction(memberId: string) {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const supabase = createSupabaseServer();
  // Solo los mensajes ENTRANTES (de miembros, no respuestas de la
  // Secretaría) se marcan como leídos al abrir la conversación.
  // Usamos is_admin_reply en vez de from_user_id porque admin y miembro
  // pueden ser el mismo usuario en pruebas/self-test.
  await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("member_id", memberId)
    .eq("is_admin_reply", false)
    .eq("read", false);
  revalidatePath(`/admin/chat/${memberId}`);
  revalidatePath("/admin/chat");
  revalidatePath("/admin");
}
