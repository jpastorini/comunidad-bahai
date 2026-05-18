"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const BUCKET = "comunicados"; // reuse — public bucket with admin-only write

async function uploadImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = createSupabaseServer();
  const ext = file.name.split(".").pop() || "bin";
  const path = `calendar/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("Upload calendar image error:", error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertEventAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const date = formData.get("date") as string;
  const [year, month, day] = date.split("-").map((n) => parseInt(n, 10));

  const durationStr = formData.get("duration_minutes") as string | null;
  const durationMinutes = Math.max(
    5,
    Math.min(60 * 12, parseInt(durationStr || "60", 10) || 60)
  );

  const payload: Record<string, unknown> = {
    day,
    month,
    year,
    title: formData.get("title") as string,
    time: formData.get("time") as string,
    color: formData.get("color") as string,
    description: (formData.get("description") as string) || null,
    location: (formData.get("location") as string) || null,
    duration_minutes: durationMinutes,
  };

  if (!date || !payload.title) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/calendario");
  }

  const imageFile = formData.get("image_file") as File | null;
  const removeImage = formData.get("image_remove") === "on";
  if (imageFile && imageFile.size > 0) {
    const url = await uploadImage(imageFile);
    if (url) payload.image_url = url;
  } else if (removeImage) {
    payload.image_url = null;
  }

  const { error } = id
    ? await supabase.from("calendar_events").update(payload).eq("id", id)
    : await supabase.from("calendar_events").insert(payload);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Evento actualizado." : "Evento creado." }
  );

  revalidatePath("/admin/calendario");
  revalidatePath("/calendario");
  redirect("/admin/calendario");
}

export async function deleteEventAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Evento borrado." }
    );
  }
  revalidatePath("/admin/calendario");
  revalidatePath("/calendario");
}
