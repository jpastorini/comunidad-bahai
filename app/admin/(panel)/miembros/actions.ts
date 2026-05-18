"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

export async function updateMemberAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  const payload = {
    role: (formData.get("role") as string) === "admin" ? "admin" : "member",
    can_respond_chat: formData.get("can_respond_chat") === "on",
    can_manage_treasury: formData.get("can_manage_treasury") === "on",
    full_name: (formData.get("full_name") as string) || null,
  };

  if (!id) redirect("/admin/miembros");
  const { error } = await supabase.from("profiles").update(payload).eq("id", id);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Miembro actualizado." }
  );

  revalidatePath("/admin/miembros");
  redirect("/admin/miembros");
}
