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
  const [year, month, day] = (date || "").split("-").map((n) => parseInt(n, 10));

  const durationStr = formData.get("duration_minutes") as string | null;
  const durationMinutes = Math.max(
    5,
    Math.min(60 * 12, parseInt(durationStr || "60", 10) || 60)
  );

  // Si es edición de un evento existente, traemos los campos protegidos
  // por si es system-seeded (Día Sagrado): título, fecha, kind y system_id
  // no se pueden modificar — solo hora, lugar, descripción, imagen y duración.
  type ExistingEvent = {
    is_system_seeded: boolean | null;
    day: number;
    month: number;
    year: number;
    title: string;
    kind: string | null;
    system_id: string | null;
    official_date: string | null;
  };
  let existing: ExistingEvent | null = null;

  if (id) {
    const { data } = await supabase
      .from("calendar_events")
      .select("is_system_seeded, day, month, year, title, kind, system_id, official_date")
      .eq("id", id)
      .maybeSingle();
    existing = (data as ExistingEvent | null) ?? null;
  }

  const isProtected = existing?.is_system_seeded === true;

  // Build payload — los campos protegidos vienen del registro existente.
  const payload: Record<string, unknown> = {
    time: formData.get("time") as string,
    description: (formData.get("description") as string) || null,
    location: (formData.get("location") as string) || null,
    duration_minutes: durationMinutes,
  };

  if (isProtected && existing) {
    payload.day = existing.day;
    payload.month = existing.month;
    payload.year = existing.year;
    payload.title = existing.title;
    payload.color = formData.get("color") as string; // color sí se puede ajustar
  } else {
    payload.day = day;
    payload.month = month;
    payload.year = year;
    payload.title = formData.get("title") as string;
    payload.color = formData.get("color") as string;
    // Tipo elegible a mano: actividad_general o reunion_ael. Las Fiestas y
    // Días Sagrados se siembran automáticamente y no se pueden setear acá.
    const rawKind = formData.get("kind") as string | null;
    payload.kind =
      rawKind === "reunion_ael" ? "reunion_ael" : "actividad_general";
  }

  if (!isProtected && (!date || !payload.title)) {
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
    // Verificar que el evento no sea system-seeded (Día Sagrado).
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("is_system_seeded, title")
      .eq("id", id)
      .maybeSingle();

    if (existing?.is_system_seeded) {
      setFlashToast({
        tone: "error",
        message: `"${existing.title}" no se puede borrar — es un Día Sagrado oficial.`,
      });
      revalidatePath("/admin/calendario");
      return;
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Evento borrado." }
    );
  }
  revalidatePath("/admin/calendario");
  revalidatePath("/calendario");
}
