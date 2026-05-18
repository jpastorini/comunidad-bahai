"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const BUCKET = "comunicados";

async function uploadPdf(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = createSupabaseServer();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `mensajes/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("Upload PDF error:", error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertMessageAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const title = formData.get("title") as string;
  const date = formData.get("date") as string;

  if (!date || !title) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/mensajes");
  }

  // Casa Universal: el "mensaje" ES el PDF. excerpt es solo para listas.
  const payload: Record<string, unknown> = {
    date,
    title,
    excerpt: title, // satisface el NOT NULL del schema; no se muestra
    full_text: null,
    subject: null,
    image_url: null,
    is_new: formData.get("is_new") === "on",
    source: "casa_universal",
  };

  const pdfFile = formData.get("pdf_file") as File | null;
  const removePdf = formData.get("pdf_remove") === "on";

  if (pdfFile && pdfFile.size > 0) {
    const url = await uploadPdf(pdfFile);
    if (url) payload.pdf_url = url;
  } else if (removePdf) {
    payload.pdf_url = null;
  }

  const { error } = id
    ? await supabase.from("messages").update(payload).eq("id", id)
    : await supabase.from("messages").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Mensaje actualizado." : "Mensaje publicado." }
  );

  revalidatePath("/admin/mensajes");
  revalidatePath("/mensajes");
  redirect("/admin/mensajes");
}

export async function deleteMessageAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("source", "casa_universal");
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Mensaje borrado." }
    );
  }
  revalidatePath("/admin/mensajes");
  revalidatePath("/mensajes");
}
