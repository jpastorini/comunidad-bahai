/**
 * Feed social del Home (Fase 2).
 *
 * El feed es **derivado** — no hay tabla `posts`. Se construye combinando:
 *   1. Uploads recientes de fotos a event_photos, agrupados por
 *      (event_type, event_id, uploader_user_id, ventana de 6 horas).
 *   2. Comunicados de la Asamblea Local recientes (messages con
 *      source='asamblea_local').
 *
 * Ordenado por timestamp más reciente del grupo/comunicado.
 */

import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { EventPhoto, Message } from "./types";

const GROUPING_WINDOW_HOURS = 6;
const GROUPING_WINDOW_MS = GROUPING_WINDOW_HOURS * 60 * 60 * 1000;
const PHOTOS_PER_GROUP_PREVIEW = 4;
const RAW_PHOTO_FETCH = 60; // últimos N uploads para agrupar
const RAW_ANNOUNCEMENT_FETCH = 5;

export type FeedPhotoGroup = {
  type: "photos";
  id: string; // clave compuesta única
  event_type: "calendar" | "feast";
  event_id: string;
  event_title: string;
  event_when: string | null; // texto con fecha/hora si lo tenemos
  uploader_user_id: string;
  uploader_name: string;
  uploader_avatar_url: string | null;
  photo_ids: string[];
  preview_urls: string[]; // hasta PHOTOS_PER_GROUP_PREVIEW
  photo_count: number;
  reaction_total: number;
  comment_total: number;
  first_at: string;
  last_at: string; // usado para ordenar
};

export type FeedAnnouncement = {
  type: "announcement";
  id: string;
  title: string;
  excerpt: string;
  created_at: string;
};

export type FeedItem = FeedPhotoGroup | FeedAnnouncement;

export async function getHomeFeed(limit = 10): Promise<FeedItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();

  // 1) Últimas N fotos (las RLS filtran por localidad).
  const { data: rawPhotos } = await supabase
    .from("event_photos")
    .select(
      "id, event_type, event_id, uploader_user_id, uploader_name, public_url, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(RAW_PHOTO_FETCH);

  const photos = (rawPhotos ?? []) as Array<
    Pick<
      EventPhoto,
      | "id"
      | "event_type"
      | "event_id"
      | "uploader_user_id"
      | "uploader_name"
      | "public_url"
      | "created_at"
    >
  >;

  // Agrupación por (event_type, event_id, uploader, bucket de 6h).
  // El bucket se calcula en milisegundos relativos a epoch para que
  // dos uploads cercanos en tiempo caigan en el mismo grupo.
  const groupsMap = new Map<string, FeedPhotoGroup>();
  for (const p of photos) {
    const ts = new Date(p.created_at).getTime();
    const bucket = Math.floor(ts / GROUPING_WINDOW_MS);
    const key = `${p.event_type}:${p.event_id}:${p.uploader_user_id}:${bucket}`;
    let g = groupsMap.get(key);
    if (!g) {
      g = {
        type: "photos",
        id: key,
        event_type: p.event_type,
        event_id: p.event_id,
        event_title: "", // se llena más abajo
        event_when: null,
        uploader_user_id: p.uploader_user_id,
        uploader_name: p.uploader_name,
        uploader_avatar_url: null,
        photo_ids: [],
        preview_urls: [],
        photo_count: 0,
        reaction_total: 0,
        comment_total: 0,
        first_at: p.created_at,
        last_at: p.created_at,
      };
      groupsMap.set(key, g);
    }
    g.photo_ids.push(p.id);
    g.photo_count += 1;
    if (g.preview_urls.length < PHOTOS_PER_GROUP_PREVIEW) {
      g.preview_urls.push(p.public_url);
    }
    if (p.created_at < g.first_at) g.first_at = p.created_at;
    if (p.created_at > g.last_at) g.last_at = p.created_at;
  }

  const groups = Array.from(groupsMap.values());

  // 2) Comunicados recientes de Asamblea Local.
  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, title, excerpt, date")
    .eq("source", "asamblea_local")
    .order("date", { ascending: false })
    .limit(RAW_ANNOUNCEMENT_FETCH);

  const announcements: FeedAnnouncement[] = (
    (rawMessages ?? []) as Array<
      Pick<Message, "id" | "title" | "excerpt"> & { date: string }
    >
  ).map((m) => ({
    type: "announcement",
    id: m.id,
    title: m.title,
    excerpt: m.excerpt,
    created_at: m.date,
  }));

  // 3) Merge + sort por timestamp más reciente, take limit.
  const merged: FeedItem[] = [
    ...groups,
    ...announcements,
  ].sort((a, b) => tsOf(b).localeCompare(tsOf(a)));
  const top = merged.slice(0, limit);

  // 4) Enriquecer photo groups con datos del evento, avatares y contadores.
  const photoGroups = top.filter(
    (i): i is FeedPhotoGroup => i.type === "photos"
  );
  await enrichPhotoGroups(photoGroups);

  return top;
}

function tsOf(item: FeedItem): string {
  return item.type === "photos" ? item.last_at : item.created_at;
}

async function enrichPhotoGroups(groups: FeedPhotoGroup[]) {
  if (groups.length === 0) return;
  const supabase = createSupabaseServer();

  const calendarIds = Array.from(
    new Set(groups.filter((g) => g.event_type === "calendar").map((g) => g.event_id))
  );
  const feastIds = Array.from(
    new Set(groups.filter((g) => g.event_type === "feast").map((g) => g.event_id))
  );
  const uploaderIds = Array.from(new Set(groups.map((g) => g.uploader_user_id)));
  const allPhotoIds = groups.flatMap((g) => g.photo_ids);

  // Eventos del calendario
  const calendarMap = new Map<string, { title: string; when: string | null }>();
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
      calendarMap.set(r.id, {
        title: r.title,
        when: formatEventDate(r.day, r.month, r.year, r.time),
      });
    }
  }

  // Fiestas
  const feastMap = new Map<string, { title: string; when: string | null }>();
  if (feastIds.length > 0) {
    const { data } = await supabase
      .from("feasts")
      .select("id, bahai_month_name")
      .in("id", feastIds);
    for (const r of (data ?? []) as Array<{
      id: string;
      bahai_month_name: string;
    }>) {
      feastMap.set(r.id, {
        title: `Fiesta de ${r.bahai_month_name}`,
        when: null,
      });
    }
  }

  // Avatares de uploaders
  const avatarMap = new Map<string, string | null>();
  if (uploaderIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", uploaderIds);
    for (const r of (data ?? []) as Array<{
      id: string;
      avatar_url: string | null;
    }>) {
      avatarMap.set(r.id, r.avatar_url);
    }
  }

  // Contadores agregados de reactions + comments (agregados en SQL).
  const reactionsByPhoto = new Map<string, number>();
  const commentsByPhoto = new Map<string, number>();
  if (allPhotoIds.length > 0) {
    const { data: counts } = await supabase.rpc(
      "get_photo_interaction_counts",
      { photo_ids: allPhotoIds }
    );
    for (const row of (counts ?? []) as Array<{
      photo_id: string;
      reaction_count: number;
      comment_count: number;
    }>) {
      reactionsByPhoto.set(row.photo_id, Number(row.reaction_count) || 0);
      commentsByPhoto.set(row.photo_id, Number(row.comment_count) || 0);
    }
  }

  for (const g of groups) {
    const ev =
      g.event_type === "calendar"
        ? calendarMap.get(g.event_id)
        : feastMap.get(g.event_id);
    g.event_title = ev?.title ?? "Evento";
    g.event_when = ev?.when ?? null;
    g.uploader_avatar_url = avatarMap.get(g.uploader_user_id) ?? null;
    g.reaction_total = g.photo_ids.reduce(
      (sum, id) => sum + (reactionsByPhoto.get(id) ?? 0),
      0
    );
    g.comment_total = g.photo_ids.reduce(
      (sum, id) => sum + (commentsByPhoto.get(id) ?? 0),
      0
    );
  }
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
