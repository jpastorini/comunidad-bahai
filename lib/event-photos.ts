import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { EventPhoto } from "./types";

export const EVENT_PHOTOS_BUCKET = "event-photos";

/** Máximo de bytes pre-compresión que aceptamos (el cliente comprime antes). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Límite blando: fotos que un usuario puede subir por mes. */
export const MONTHLY_UPLOAD_LIMIT = 100;

/** Cantidad de fotos cargadas por defecto en la galería. */
export const GALLERY_PAGE_SIZE = 50;

/** Campos que necesita la galería (grid + lightbox). */
const GALLERY_PHOTO_FIELDS =
  "id, event_type, event_id, uploader_user_id, uploader_name, public_url, caption, locality_id, created_at";

/**
 * Lista fotos de un evento, paginadas (más recientes primero). Las RLS
 * filtran por localidad, así que esta query solo retorna lo que el usuario
 * actual puede ver. Por defecto trae las primeras GALLERY_PAGE_SIZE.
 */
export async function getEventPhotos(
  eventType: "calendar" | "feast",
  eventId: string,
  options?: { limit?: number; offset?: number }
): Promise<EventPhoto[]> {
  if (!isSupabaseConfigured()) return [];
  const limit = options?.limit ?? GALLERY_PAGE_SIZE;
  const offset = options?.offset ?? 0;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("event_photos")
    .select(GALLERY_PHOTO_FIELDS)
    .eq("event_type", eventType)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error("[getEventPhotos] error:", error);
    return [];
  }
  return (data ?? []) as EventPhoto[];
}

/** Total de fotos de un evento (para mostrar el contador real sin traerlas todas). */
export async function getEventPhotoCount(
  eventType: "calendar" | "feast",
  eventId: string
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = createSupabaseServer();
  const { count } = await supabase
    .from("event_photos")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .eq("event_id", eventId);
  return count ?? 0;
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
