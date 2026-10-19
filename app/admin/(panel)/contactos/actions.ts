"use server";

import { revalidatePath } from "next/cache";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Marcar un pedido de contacto como atendido (o volverlo a nuevo) y
 * anotar cómo siguió. La RLS (080) acota a la comunidad y al tag de chat;
 * acá solo se repite el guard en palabras.
 */
export async function setContactStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "nuevo" && status !== "atendido")) return;

  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("contact_requests")
    .update({
      status,
      handled_at: status === "atendido" ? new Date().toISOString() : null,
      handled_by: status === "atendido" ? session.user.id : null,
    })
    .eq("id", id);
  if (error) console.error(`[contactos] status: ${error.code} ${error.message}`);
  revalidatePath("/admin/contactos");
  revalidatePath("/admin");
}

export async function saveContactNotesAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  if (!id) return;
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("contact_requests")
    .update({ notes: notes || null })
    .eq("id", id);
  if (error) console.error(`[contactos] notes: ${error.code} ${error.message}`);
  revalidatePath("/admin/contactos");
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("contact_requests").delete().eq("id", id);
  if (error) console.error(`[contactos] delete: ${error.code} ${error.message}`);
  revalidatePath("/admin/contactos");
  revalidatePath("/admin");
}
