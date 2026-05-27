"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getLocalityMemberIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const BUCKET = "comunicados";

async function uploadAttachment(
  file: File | null,
  folder: "pdf" | "image"
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = createSupabaseServer();
  const ext = file.name.split(".").pop() || (folder === "pdf" ? "pdf" : "bin");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error(`Upload ${folder} error:`, error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertComunicadoAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const title = formData.get("title") as string;
  const subject = (formData.get("subject") as string) || null;
  const fullText = (formData.get("full_text") as string) || null;
  const excerptInput = (formData.get("excerpt") as string)?.trim();
  const excerpt =
    excerptInput && excerptInput.length > 0
      ? excerptInput
      : (fullText ?? subject ?? title ?? "").trim().slice(0, 160);

  const payload: Record<string, unknown> = {
    date: formData.get("date") as string,
    title,
    subject,
    excerpt,
    full_text: fullText,
    is_new: formData.get("is_new") === "on",
    source: "asamblea_local",
  };

  if (!payload.date || !payload.title) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/comunicados");
  }

  const pdfFile = formData.get("pdf_file") as File | null;
  const imageFile = formData.get("image_file") as File | null;
  const removePdf = formData.get("pdf_remove") === "on";
  const removeImage = formData.get("image_remove") === "on";

  if (pdfFile && pdfFile.size > 0) {
    const url = await uploadAttachment(pdfFile, "pdf");
    if (url) payload.pdf_url = url;
  } else if (removePdf) {
    payload.pdf_url = null;
  }

  if (imageFile && imageFile.size > 0) {
    const url = await uploadAttachment(imageFile, "image");
    if (url) payload.image_url = url;
  } else if (removeImage) {
    payload.image_url = null;
  }

  // Los comunicados son SIEMPRE locales: fijamos la localidad explícita
  // (ya no hay trigger de auto-locality en messages).
  const { error } = id
    ? await supabase.from("messages").update(payload).eq("id", id)
    : await supabase
        .from("messages")
        .insert({ ...payload, locality_id: session.locality.id });

  // Push solo al PUBLICAR uno nuevo (no al editar), a todos los miembros de
  // la localidad — incluido quien publica, sirve como confirmación.
  if (!id && !error) {
    const recipients = await getLocalityMemberIds(session.locality.id);
    await sendPushToUsers(recipients, {
      title: "Nuevo comunicado",
      body: title,
      url: "/comunicados",
      tag: "comunicado",
    });
  }

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Comunicado actualizado." : "Comunicado publicado." }
  );

  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  revalidatePath("/");
  redirect("/admin/comunicados");
}

export async function deleteComunicadoAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("source", "asamblea_local");
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Comunicado borrado." }
    );
  }
  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  revalidatePath("/");
}
