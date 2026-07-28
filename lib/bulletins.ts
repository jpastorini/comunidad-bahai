import { getUnifiedCalendarItems } from "./data";
import { eventMetaKey, resolveEventMeta } from "./event-photos";
import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type {
  Bulletin,
  BulletinAnnouncementItem,
  BulletinContent,
  BulletinEventItem,
  BulletinPhotoItem,
} from "./types";

// ─── Boletín local ───────────────────────────────────────────────
// Capa de datos de las ediciones (tabla `bulletins`) y del compilado
// de candidatos: lo que el editor ofrece para incluir en una edición
// (eventos próximos, comunicados y fotos recientes de la localidad).

const BULLETIN_FIELDS =
  "id, locality_id, title, editorial, content, status, share_token, published_at, created_by, created_at, updated_at";

/** Ventana hacia atrás para comunicados y fotos candidatas. */
export const CANDIDATE_LOOKBACK_DAYS = 45;
/** Horizonte hacia adelante para eventos candidatos. */
export const CANDIDATE_HORIZON_DAYS = 60;

const EMPTY_CONTENT: BulletinContent = {
  events: [],
  announcements: [],
  photos: [],
};

const MONTHS_ABBR_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Re-construye un BulletinContent a partir de JSON no confiable (viene
 * de un hidden input del editor). Solo copia los campos conocidos como
 * strings; cualquier otra cosa se descarta.
 */
export function sanitizeBulletinContent(raw: unknown): BulletinContent {
  const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
  const asStrOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const obj = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  const events: BulletinEventItem[] = arr(obj.events)
    .map((e) => e as Record<string, unknown>)
    .filter((e) => asStr(e.id) && asStr(e.title))
    .map((e) => ({
      id: asStr(e.id),
      title: asStr(e.title),
      dateLabel: asStr(e.dateLabel),
      time: asStrOrNull(e.time),
      location: asStrOrNull(e.location),
    }));

  const announcements: BulletinAnnouncementItem[] = arr(obj.announcements)
    .map((a) => a as Record<string, unknown>)
    .filter((a) => asStr(a.id) && asStr(a.title))
    .map((a) => ({
      id: asStr(a.id),
      title: asStr(a.title),
      excerpt: asStr(a.excerpt),
      date: asStr(a.date),
    }));

  const photos: BulletinPhotoItem[] = arr(obj.photos)
    .map((p) => p as Record<string, unknown>)
    .filter((p) => asStr(p.id) && asStr(p.url))
    .map((p) => ({
      id: asStr(p.id),
      url: asStr(p.url),
      caption: asStrOrNull(p.caption),
      eventTitle: asStr(p.eventTitle) || "Evento",
    }));

  return { events, announcements, photos };
}

function parseRow(row: Record<string, unknown>): Bulletin {
  return {
    ...(row as unknown as Bulletin),
    content: sanitizeBulletinContent(row.content),
  };
}

// ─── Queries ─────────────────────────────────────────────────────

/** Todas las ediciones de la localidad, para el panel (borradores primero). */
export async function getAdminBulletins(localityId: string): Promise<Bulletin[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("bulletins")
    .select(BULLETIN_FIELDS)
    .eq("locality_id", localityId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[getAdminBulletins] error:", error);
    return [];
  }
  return (data ?? []).map((r) => parseRow(r as Record<string, unknown>));
}

/** Una edición por id (el panel; la RLS limita a quien corresponde). */
export async function getBulletin(id: string): Promise<Bulletin | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("bulletins")
    .select(BULLETIN_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return data ? parseRow(data as Record<string, unknown>) : null;
}

/** Ediciones publicadas de la localidad (vista de miembros). */
export async function getPublishedBulletins(
  localityId: string
): Promise<Bulletin[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("bulletins")
    .select(BULLETIN_FIELDS)
    .eq("locality_id", localityId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[getPublishedBulletins] error:", error);
    return [];
  }
  return (data ?? []).map((r) => parseRow(r as Record<string, unknown>));
}

/** Una edición publicada por id (detalle de miembro). */
export async function getPublishedBulletin(id: string): Promise<Bulletin | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("bulletins")
    .select(BULLETIN_FIELDS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data ? parseRow(data as Record<string, unknown>) : null;
}

/**
 * Edición publicada por share_token, para la página pública /b/<token>.
 * Usa la service-role key (no hay policy para anon a propósito): el
 * acceso queda limitado a quien tenga el link con el token exacto.
 */
export async function getPublicBulletin(
  token: string
): Promise<{ bulletin: Bulletin; localityName: string } | null> {
  // Token = 64 hex chars; cortamos temprano cualquier otra cosa.
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const supabase = createSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("bulletins")
    .select(BULLETIN_FIELDS)
    .eq("share_token", token)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;

  const bulletin = parseRow(data as Record<string, unknown>);
  const { data: loc } = await supabase
    .from("localities")
    .select("name")
    .eq("id", bulletin.locality_id)
    .maybeSingle();

  return {
    bulletin,
    localityName: (loc as { name: string } | null)?.name ?? "Comunidad Bahá'í",
  };
}

// ─── Compilado de candidatos ─────────────────────────────────────

function eventDateLabel(day: number, month: number, year: number): string {
  const monthAbbr = MONTHS_ABBR_ES[month - 1] ?? "";
  const yearSuffix = year !== new Date().getFullYear() ? ` ${year}` : "";
  return `${day} ${monthAbbr}${yearSuffix}`;
}

/**
 * Contenido candidato para armar una edición: próximos eventos del
 * calendario unificado (incluye Fiestas y Días Sagrados), comunicados
 * locales recientes y fotos recientes de la localidad. El editor elige
 * qué incluir; nada se agrega solo.
 */
export async function compileBulletinCandidates(
  localityId: string
): Promise<BulletinContent> {
  if (!isSupabaseConfigured()) return EMPTY_CONTENT;
  const supabase = createSupabaseServer();

  const today = new Date();
  const todayKey =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + CANDIDATE_HORIZON_DAYS);
  const horizonKey =
    horizon.getFullYear() * 10000 +
    (horizon.getMonth() + 1) * 100 +
    horizon.getDate();
  const since = new Date(today);
  since.setDate(since.getDate() - CANDIDATE_LOOKBACK_DAYS);

  const [unified, announcementsRes, photosRes] = await Promise.all([
    getUnifiedCalendarItems(),
    supabase
      .from("messages")
      .select("id, title, excerpt, date")
      .eq("source", "asamblea_local")
      .eq("locality_id", localityId)
      .gte("date", since.toISOString().slice(0, 10))
      .order("date", { ascending: false })
      .limit(12),
    supabase
      .from("event_photos")
      .select("id, public_url, caption, event_type, event_id")
      .eq("locality_id", localityId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const events: BulletinEventItem[] = unified
    .filter((e) => {
      const key = e.year * 10000 + e.month * 100 + e.day;
      return key >= todayKey && key <= horizonKey;
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      dateLabel: eventDateLabel(e.day, e.month, e.year),
      time: e.time || null,
      location: e.location,
    }));

  const announcements: BulletinAnnouncementItem[] = (
    (announcementsRes.data ?? []) as Array<{
      id: string;
      title: string;
      excerpt: string | null;
      date: string;
    }>
  ).map((a) => ({
    id: a.id,
    title: a.title,
    excerpt: a.excerpt ?? "",
    date: a.date,
  }));

  const photoRows = (photosRes.data ?? []) as Array<{
    id: string;
    public_url: string;
    caption: string | null;
    event_type: "calendar" | "feast";
    event_id: string;
  }>;
  const meta = await resolveEventMeta(photoRows);
  const photos: BulletinPhotoItem[] = photoRows.map((p) => ({
    id: p.id,
    url: p.public_url,
    caption: p.caption,
    eventTitle:
      meta.get(eventMetaKey(p.event_type, p.event_id))?.title ?? "Evento",
  }));

  return { events, announcements, photos };
}
