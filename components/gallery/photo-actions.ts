"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import {
  EVENT_PHOTOS_BUCKET,
  MAX_UPLOAD_BYTES,
  MONTHLY_UPLOAD_LIMIT,
  eventMetaKey,
  getMonthlyUploadCount,
  resolveEventMeta,
} from "@/lib/event-photos";
import { createSupabaseServer } from "@/lib/supabase/server";

type UploadResult = { ok: boolean; error: string | null };

export async function uploadEventPhotoAction(
  formData: FormData
): Promise<UploadResult> {
  const session = await requireMember();
  const supabase = createSupabaseServer();

  const eventType = formData.get("event_type") as string;
  const eventId = formData.get("event_id") as string;
  const caption = ((formData.get("caption") as string) || "").trim();
  const consent = formData.get("consent") === "on";
  const file = formData.get("file") as File | null;

  if (!consent) {
    return {
      ok: false,
      error: "Debes marcar el consentimiento antes de subir la foto.",
    };
  }
  if (!file || file.size === 0) {
    return { ok: false, error: "Seleccioná una foto." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `La foto supera los ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "El archivo debe ser una imagen." };
  }
  if (eventType !== "calendar" && eventType !== "feast") {
    return { ok: false, error: "Tipo de evento inválido." };
  }
  if (!eventId) {
    return { ok: false, error: "Falta el identificador del evento." };
  }

  // Límite blando mensual
  const monthlyCount = await getMonthlyUploadCount(session.user.id);
  if (monthlyCount >= MONTHLY_UPLOAD_LIMIT) {
    return {
      ok: false,
      error: `Alcanzaste el límite de ${MONTHLY_UPLOAD_LIMIT} fotos por mes.`,
    };
  }

  const extFromName = file.name.split(".").pop();
  const ext = (extFromName || (file.type.split("/")[1] ?? "jpg"))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 4) || "jpg";
  const path = `${session.locality.id}/${eventType}/${eventId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(EVENT_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[uploadEventPhotoAction] storage error:", uploadError);
    return { ok: false, error: `Error al subir: ${uploadError.message}` };
  }

  const { data: pub } = supabase.storage
    .from(EVENT_PHOTOS_BUCKET)
    .getPublicUrl(path);

  // Snapshot del título del evento (para mostrarlo en el boletín nacional,
  // donde la RLS no deja resolver eventos de otras localidades).
  const meta = await resolveEventMeta([{ event_type: eventType, event_id: eventId }]);
  const eventTitle = meta.get(eventMetaKey(eventType, eventId))?.title ?? null;

  const { error: insertError } = await supabase.from("event_photos").insert({
    event_type: eventType,
    event_id: eventId,
    uploader_user_id: session.user.id,
    uploader_name: session.profile.full_name || session.user.email || "Miembro",
    storage_path: path,
    public_url: pub.publicUrl,
    caption: caption || null,
    event_title: eventTitle,
    file_size_bytes: file.size,
    mime_type: file.type,
    locality_id: session.locality.id,
  });

  if (insertError) {
    // Limpiar storage si falló el insert.
    await supabase.storage.from(EVENT_PHOTOS_BUCKET).remove([path]);
    console.error("[uploadEventPhotoAction] insert error:", insertError);
    return { ok: false, error: `Error: ${insertError.message}` };
  }

  if (eventType === "calendar") {
    revalidatePath(`/calendario/${eventId}`);
  } else {
    revalidatePath(`/fiestas/${eventId}`);
  }

  return { ok: true, error: null };
}

export async function deleteEventPhotoAction(
  photoId: string
): Promise<UploadResult> {
  const session = await requireMember();
  const supabase = createSupabaseServer();

  const { data: photo } = await supabase
    .from("event_photos")
    .select("*")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) return { ok: false, error: "Foto no encontrada." };

  const isOwner = photo.uploader_user_id === session.user.id;
  const isAdmin =
    session.profile.role === "admin" &&
    photo.locality_id === session.locality.id;

  if (!isOwner && !isAdmin) {
    return { ok: false, error: "No tenés permiso para borrar esta foto." };
  }

  const { error: dbError } = await supabase
    .from("event_photos")
    .delete()
    .eq("id", photoId);
  if (dbError) return { ok: false, error: dbError.message };

  // Best-effort: borrar del storage. Si falla, queda huérfano pero no
  // bloqueamos al usuario.
  await supabase.storage.from(EVENT_PHOTOS_BUCKET).remove([photo.storage_path]);

  if (photo.event_type === "calendar") {
    revalidatePath(`/calendario/${photo.event_id}`);
  } else {
    revalidatePath(`/fiestas/${photo.event_id}`);
  }

  return { ok: true, error: null };
}
