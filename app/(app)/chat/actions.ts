"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

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

  revalidatePath("/chat");
}
