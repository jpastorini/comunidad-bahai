"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { to24h } from "@/lib/format";
import { invitationDateLabel, invitationTimeLabel } from "@/lib/invitation";
import { getLocalityMemberIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import { isStructureLocality } from "@/lib/types";

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
  const session = await requirePermission("calendario");
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
    time: to24h(formData.get("time") as string),
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

  // Solo una estructura (082) comparte un evento con la comunidad (085):
  // lo de una Asamblea ya es de su comunidad.
  if (isStructureLocality(session.locality)) {
    payload.community_visible = formData.get("community_visible") === "on";
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

  // El alta devuelve el id: "Crear y hacer la invitación" sigue de largo
  // al creador de invitaciones de ese evento.
  let savedId = id;
  let error: { code?: string; message: string } | null = null;
  if (id) {
    ({ error } = await supabase.from("calendar_events").update(payload).eq("id", id));
  } else {
    const res = await supabase
      .from("calendar_events")
      .insert(payload)
      .select("id")
      .single();
    error = res.error;
    savedId = (res.data as { id: string } | null)?.id ?? null;
  }

  setFlashToast(
    error
      ? {
          tone: "error",
          message:
            error.code === "PGRST204" || error.code === "42703"
              ? "Falta aplicar la migración 085 en la base."
              : `Error: ${error.message}`,
        }
      : { tone: "success", message: id ? "Evento actualizado." : "Evento creado." }
  );

  revalidatePath("/admin/calendario");
  revalidatePath("/calendario");
  if (!error && savedId && formData.get("then") === "invitacion") {
    redirect(`/admin/calendario/${savedId}/invitacion`);
  }
  redirect("/admin/calendario");
}

/**
 * La actividad que nace del Creador de invitaciones: quien arma la imagen
 * primero no tiene que cargar el evento aparte. Devuelve el resultado en
 * vez de redirigir, porque el editor sigue abierto para compartir la
 * imagen.
 */
export async function createEventFromInvitationAction(formData: FormData): Promise<{
  ok: boolean;
  id?: string;
  error?: string;
  /** La actividad se creó, pero la imagen no se pudo guardar. */
  imageFailed?: boolean;
  notified?: boolean;
}> {
  const session = await requirePermission("calendario");
  const supabase = createSupabaseServer();

  const title = ((formData.get("title") as string) || "").trim();
  const date = ((formData.get("date") as string) || "").trim();
  const time = ((formData.get("time") as string) || "").trim();
  const location = ((formData.get("location") as string) || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!title || !m || !time || !location) {
    return { ok: false, error: "Faltan el título, la fecha, la hora o el lugar." };
  }

  const structure = isStructureLocality(session.locality);
  const share = formData.get("share") === "on";

  const payload: Record<string, unknown> = {
    title,
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    day: parseInt(m[3], 10),
    time: to24h(time),
    location,
    description: ((formData.get("description") as string) || "").trim() || null,
    duration_minutes: 60,
    color: "#2A3F8F",
    kind: "actividad_general",
  };
  // En una estructura (082), "compartir" es mostrarla en el calendario de
  // la comunidad (085): lo de una Asamblea ya es de su comunidad.
  if (structure) payload.community_visible = share;

  const imageFile = formData.get("image_file") as File | null;
  const imageUrl = await uploadImage(imageFile);
  if (imageUrl) payload.image_url = imageUrl;

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    console.error("createEventFromInvitation:", error);
    return { ok: false, error: error?.message ?? "No se pudo crear la actividad." };
  }
  const id = (data as { id: string }).id;

  // El aviso a la comunidad: opcional y con la audiencia elegida, como un
  // comunicado. Una estructura no avisa (ver "Pendiente posible", 085).
  let notified = false;
  if (share && !structure) {
    const recipients = await getLocalityMemberIds(session.locality.id, {
      bahaiOnly: formData.get("audience") === "creyentes",
    });
    await sendPushToUsers(
      recipients.filter((uid) => uid !== session.user.id),
      {
        title: "Nueva actividad",
        body: [title, invitationDateLabel(date), invitationTimeLabel(time)]
          .filter(Boolean)
          .join(" · "),
        url: `/calendario/${id}`,
        tag: `evento-${id}`,
      }
    );
    notified = true;
  }

  revalidatePath("/admin/calendario");
  revalidatePath("/calendario");
  return {
    ok: true,
    id,
    imageFailed: Boolean(imageFile && imageFile.size > 0 && !imageUrl),
    notified,
  };
}

export async function deleteEventAction(formData: FormData) {
  await requirePermission("calendario");
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
