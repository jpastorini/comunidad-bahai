import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { EventPhoto } from "./types";

export const EVENT_PHOTOS_BUCKET = "event-photos";

/** Máximo de bytes pre-compresión que aceptamos (el cliente comprime antes). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Límite blando: fotos que un usuario puede subir por mes. */
export const MONTHLY_UPLOAD_LIMIT = 100;

/**
 * Lista fotos de un evento. Las RLS filtran por localidad,
 * así que esta query solo retorna lo que el usuario actual puede ver.
 */
export async function getEventPhotos(
  eventType: "calendar" | "feast",
  eventId: string
): Promise<EventPhoto[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("event_photos")
    .select("*")
    .eq("event_type", eventType)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getEventPhotos] error:", error);
    return [];
  }
  return (data ?? []) as EventPhoto[];
}

/** Cuenta cuántas fotos subió un usuario en los últimos 30 días. */
export async function getMonthlyUploadCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = createSupabaseServer();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { count } = await supabase
    .from("event_photos")
    .select("id", { count: "exact", head: true })
    .eq("uploader_user_id", userId)
    .gte("created_at", since.toISOString());
  return count ?? 0;
}
