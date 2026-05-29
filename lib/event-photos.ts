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

// ─── Resolución de metadatos del evento ──────────────────────────
// Una foto referencia un evento de forma polimórfica (calendar | feast).
// Este helper resuelve título (y fecha, si aplica) en batch para una lista
// de referencias. Lo comparten el feed del Home, el CRUD de admin y el
// boletín nacional.

export type EventMeta = { title: string; when: string | null };

export function eventMetaKey(
  eventType: "calendar" | "feast",
  eventId: string
): string {
  return `${eventType}:${eventId}`;
}

const MONTHS_ABBR_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatEventDate(
  day: number,
  month: number,
  year: number,
  time: string | null
): string {
  const monthAbbr = MONTHS_ABBR_ES[month - 1] ?? "";
  const date = `${day} ${monthAbbr}`;
  const yearShort = year !== new Date().getFullYear() ? ` ${year}` : "";
  return time ? `${date}${yearShort} · ${time}` : `${date}${yearShort}`;
}

export async function resolveEventMeta(
  refs: Array<{ event_type: "calendar" | "feast"; event_id: string }>
): Promise<Map<string, EventMeta>> {
  const map = new Map<string, EventMeta>();
  if (refs.length === 0) return map;
  const supabase = createSupabaseServer();

  const calendarIds = Array.from(
    new Set(refs.filter((r) => r.event_type === "calendar").map((r) => r.event_id))
  );
  const feastIds = Array.from(
    new Set(refs.filter((r) => r.event_type === "feast").map((r) => r.event_id))
  );

  if (calendarIds.length > 0) {
    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, day, month, year, time")
      .in("id", calendarIds);
    for (const r of (data ?? []) as Array<{
      id: string;
      title: string;
      day: number;
      month: number;
      year: number;
      time: string | null;
    }>) {
      map.set(eventMetaKey("calendar", r.id), {
        title: r.title,
        when: formatEventDate(r.day, r.month, r.year, r.time),
      });
    }
  }

  if (feastIds.length > 0) {
    const { data } = await supabase
      .from("feasts")
      .select("id, bahai_month_name")
      .in("id", feastIds);
    for (const r of (data ?? []) as Array<{
      id: string;
      bahai_month_name: string;
    }>) {
      map.set(eventMetaKey("feast", r.id), {
        title: `Fiesta de ${r.bahai_month_name}`,
        when: null,
      });
    }
  }

  return map;
}

// ─── Destacadas (featured) ───────────────────────────────────────

/** Máximo de fotos que se pueden destacar por evento. */
export const MAX_FEATURED_PER_EVENT = 3;

export type FeaturedPhoto = {
  id: string;
  public_url: string;
  caption: string | null;
  event_type: "calendar" | "feast";
  event_id: string;
  event_title: string;
};

/**
 * Fotos destacadas de una localidad (para la tira del Home). Solo locales:
 * filtramos por locality_id explícito porque la RLS también deja ver fotos
 * nacionales de otras comunidades.
 */
export async function getFeaturedPhotos(
  localityId: string,
  limit = 12
): Promise<FeaturedPhoto[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("event_photos")
    .select("id, public_url, caption, event_type, event_id")
    .eq("locality_id", localityId)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Array<{
    id: string;
    public_url: string;
    caption: string | null;
    event_type: "calendar" | "feast";
    event_id: string;
  }>;
  const meta = await resolveEventMeta(rows);
  return rows.map((r) => ({
    ...r,
    event_title: meta.get(eventMetaKey(r.event_type, r.event_id))?.title ?? "Evento",
  }));
}

/** Cuántas fotos están destacadas en un evento (para el tope por evento). */
export async function getFeaturedCountForEvent(
  eventType: "calendar" | "feast",
  eventId: string
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = createSupabaseServer();
  const { count } = await supabase
    .from("event_photos")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .eq("event_id", eventId)
    .eq("featured", true);
  return count ?? 0;
}

// ─── Boletín nacional ────────────────────────────────────────────

export type BulletinPhoto = {
  id: string;
  public_url: string;
  caption: string | null;
  uploader_name: string;
  created_at: string;
  event_type: "calendar" | "feast";
  event_id: string;
  event_title: string;
  locality_id: string;
  locality_name: string;
};

/** Fotos del boletín nacional: visibility='national' de todas las localidades. */
export async function getNationalBulletinPhotos(
  limit = 60
): Promise<BulletinPhoto[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("event_photos")
    .select(
      "id, public_url, caption, uploader_name, created_at, event_type, event_id, event_title, locality_id"
    )
    .eq("visibility", "national")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Usamos el `event_title` denormalizado: la RLS no deja resolver eventos
  // de otras localidades, pero el título quedó guardado al subir la foto.
  const rows = (data ?? []) as Array<{
    id: string;
    public_url: string;
    caption: string | null;
    uploader_name: string;
    created_at: string;
    event_type: "calendar" | "feast";
    event_id: string;
    event_title: string | null;
    locality_id: string;
  }>;
  const localityNames = await resolveLocalityNames(
    rows.map((r) => r.locality_id)
  );
  return rows.map((r) => ({
    id: r.id,
    public_url: r.public_url,
    caption: r.caption,
    uploader_name: r.uploader_name,
    created_at: r.created_at,
    event_type: r.event_type,
    event_id: r.event_id,
    event_title: r.event_title ?? "Evento",
    locality_id: r.locality_id,
    locality_name: localityNames.get(r.locality_id) ?? "Comunidad",
  }));
}

// ─── CRUD admin ──────────────────────────────────────────────────

export type AdminPhoto = {
  id: string;
  public_url: string;
  caption: string | null;
  uploader_name: string;
  uploader_user_id: string;
  created_at: string;
  event_type: "calendar" | "feast";
  event_id: string;
  event_title: string;
  event_when: string | null;
  featured: boolean;
  visibility: "locality" | "national";
};

/** Todas las fotos de una localidad para el panel de admin. */
export async function getAdminPhotos(
  localityId: string,
  limit = 200
): Promise<AdminPhoto[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("event_photos")
    .select(
      "id, public_url, caption, uploader_name, uploader_user_id, created_at, event_type, event_id, featured, visibility"
    )
    .eq("locality_id", localityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Array<{
    id: string;
    public_url: string;
    caption: string | null;
    uploader_name: string;
    uploader_user_id: string;
    created_at: string;
    event_type: "calendar" | "feast";
    event_id: string;
    featured: boolean;
    visibility: "locality" | "national";
  }>;
  const meta = await resolveEventMeta(rows);
  return rows.map((r) => {
    const m = meta.get(eventMetaKey(r.event_type, r.event_id));
    return {
      ...r,
      event_title: m?.title ?? "Evento",
      event_when: m?.when ?? null,
    };
  });
}

async function resolveLocalityNames(
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return map;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("localities")
    .select("id, name")
    .in("id", unique);
  for (const r of (data ?? []) as Array<{ id: string; name: string }>) {
    map.set(r.id, r.name);
  }
  return map;
}
