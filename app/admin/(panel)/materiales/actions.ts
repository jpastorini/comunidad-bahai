"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const BUCKET = "materiales";

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

export async function upsertMaterialAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const kind = formData.get("kind") as string;
  const numberStr = formData.get("number") as string | null;

  const payload: Record<string, unknown> = {
    kind,
    number:
      kind === "ruhi" && numberStr ? parseInt(numberStr, 10) : null,
    title: formData.get("title") as string,
    subtitle:
      kind === "ruhi" ? null : (formData.get("subtitle") as string) || null,
    completed: kind === "ruhi" ? formData.get("completed") === "on" : false,
    current:
      kind === "ruhi" || kind === "oracion_del_mes"
        ? formData.get("current") === "on"
        : false,
  };

  if (!payload.kind || !payload.title) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/materiales");
  }

  // Adjuntos: PDF para ruhi/escritos/oraciones, imagen para oracion_del_mes.
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

  const { error } = id
    ? await supabase.from("study_materials").update(payload).eq("id", id)
    : await supabase.from("study_materials").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Material actualizado." : "Material creado." }
  );

  revalidatePath("/admin/materiales");
  revalidatePath("/materiales");
  redirect("/admin/materiales");
}

export async function deleteMaterialAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase.from("study_materials").delete().eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Material borrado." }
    );
  }
  revalidatePath("/admin/materiales");
  revalidatePath("/materiales");
}
