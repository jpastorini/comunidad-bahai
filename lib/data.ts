/**
 * Data-access layer. Each function returns either rows from Supabase
 * (when configured) or seed data (for demo/offline).
 *
 * All functions are server-safe and async to make swapping to live data
 * a no-op for screens.
 */

import { celebrationDateFor } from "./bahai-calendar";
import { CALENDAR_KINDS, effectiveEventColor } from "./calendar-kinds";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import {
  seedActivities,
  seedCalendarEvents,
  seedChat,
  seedEscritos,
  seedFeaturedLocalAnnouncement,
  seedGoals,
  seedLocalAnnouncements,
  seedMessages,
  seedNeeds,
  seedOracionesDelMes,
  seedRuhi,
  seedStats,
  seedTreasury,
} from "./seed-data";
import type {
  Activity,
  CalendarEvent,
  ChatMessage,
  Feast,
  FeastLocation,
  FeastPrayer,
  Message,
  ServiceNeed,
  StudyMaterial,
  TeachingGoal,
  Treasury,
} from "./types";

export async function getMessages(): Promise<Message[]> {
  if (!isSupabaseConfigured()) return seedMessages;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("source", "casa_universal")
    .order("date", { ascending: false });
  if (error || !data?.length) return seedMessages;
  return data as Message[];
}

export async function getLocalAnnouncements(): Promise<Message[]> {
  if (!isSupabaseConfigured()) return seedLocalAnnouncements;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("source", "asamblea_local")
    .order("date", { ascending: false });
  if (error || !data?.length) return seedLocalAnnouncements;
  return data as Message[];
}

/** Comunicado más reciente de la Asamblea Local — mostrado en la tarjeta destacada de Home. */
export async function getLatestLocalAnnouncement(): Promise<Message | null> {
  if (!isSupabaseConfigured()) return seedFeaturedLocalAnnouncement;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("source", "asamblea_local")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Message | null) ?? seedFeaturedLocalAnnouncement ?? null;
}

export async function getActivities(): Promise<Activity[]> {
  if (!isSupabaseConfigured()) return seedActivities;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error || !data?.length) return seedActivities;
  return data as Activity[];
}

export async function getUpcomingActivities(limit = 2): Promise<Activity[]> {
  const all = await getActivities();
  return all.slice(0, limit);
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured()) return seedCalendarEvents;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .order("year", { ascending: true })
    .order("month", { ascending: true })
    .order("day", { ascending: true });
  if (error || !data?.length) return seedCalendarEvents;
  return data as CalendarEvent[];
}

export async function getCalendarEvent(id: string): Promise<CalendarEvent | null> {
  if (!isSupabaseConfigured()) {
    return seedCalendarEvents.find((e) => e.id === id) ?? null;
  }
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as CalendarEvent | null) ?? null;
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured()) return seedChat;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data?.length) return seedChat;
  return data as ChatMessage[];
}

export async function getRuhiBooks(): Promise<StudyMaterial[]> {
  if (!isSupabaseConfigured()) return seedRuhi;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("study_materials")
    .select("*")
    .eq("kind", "ruhi")
    .order("number", { ascending: true });
  if (error || !data?.length) return seedRuhi;
  return data as StudyMaterial[];
}

export async function getEscritos(): Promise<StudyMaterial[]> {
  if (!isSupabaseConfigured()) return seedEscritos;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("study_materials")
    .select("*")
    .in("kind", ["escritos", "oraciones"]);
  if (error || !data?.length) return seedEscritos;
  return data as StudyMaterial[];
}

/** Lista completa de Oraciones del mes — más recientes primero. */
export async function getOracionesDelMes(): Promise<StudyMaterial[]> {
  if (!isSupabaseConfigured()) return seedOracionesDelMes;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("study_materials")
    .select("*")
    .eq("kind", "oracion_del_mes")
    .order("created_at", { ascending: false });
  if (error || !data?.length) return seedOracionesDelMes;
  return data as StudyMaterial[];
}

/** Oración del mes actual (la más reciente). */
export async function getLatestOracionDelMes(): Promise<StudyMaterial | null> {
  const all = await getOracionesDelMes();
  return all[0] ?? null;
}

export async function getTeachingGoals(): Promise<TeachingGoal[]> {
  if (!isSupabaseConfigured()) return seedGoals;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.from("teaching_goals").select("*");
  if (error || !data?.length) return seedGoals;
  return data as TeachingGoal[];
}

export async function getCommunityStats() {
  // Stats are computed/cached separately; for the MVP we surface seed values.
  return seedStats;
}

export async function getServiceNeeds(): Promise<ServiceNeed[]> {
  if (!isSupabaseConfigured()) return seedNeeds;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("service_needs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data?.length) return seedNeeds;
  return data as ServiceNeed[];
}

export async function getTreasury(): Promise<Treasury> {
  if (!isSupabaseConfigured()) return seedTreasury;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("treasury")
    .select("*")
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Treasury | null) ?? seedTreasury;
}

// ─── Fiestas ────────────────────────────────────────────────────
export async function getFeasts(): Promise<Feast[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("feasts")
    .select("*")
    .order("bahai_year", { ascending: false })
    .order("bahai_month_index", { ascending: false });
  return (data ?? []) as Feast[];
}

export async function getFeast(id: string): Promise<Feast | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("feasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Feast | null) ?? null;
}

export async function getFeastLocations(feastId: string): Promise<FeastLocation[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("feast_locations")
    .select("*")
    .eq("feast_id", feastId)
    .order("starts_at", { ascending: true });
  return (data ?? []) as FeastLocation[];
}

export async function getFeastPrayers(feastId: string): Promise<FeastPrayer[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("feast_prayers")
    .select("*")
    .eq("feast_id", feastId)
    .order("position", { ascending: true });
  return (data ?? []) as FeastPrayer[];
}

/** Próxima Fiesta a celebrar (la in_progress, o la published más próxima). */
export async function getCurrentFeast(): Promise<Feast | null> {
  const all = await getFeasts();
  const inProgress = all.find((f) => f.status === "in_progress");
  if (inProgress) return inProgress;

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = all
    .filter(
      (f) =>
        f.status === "published" &&
        (f.gregorian_date ?? "9999-99-99") >= todayIso
    )
    .sort((a, b) =>
      (a.gregorian_date ?? "").localeCompare(b.gregorian_date ?? "")
    );
  return upcoming[0] ?? null;
}

/**
 * Badges del home para el usuario actual.
 * - chat_has_unseen: true cuando hay respuestas de la Secretaría que
 *   este miembro aún no abrió. Apaga al visitar /chat.
 * - Otros indicadores solo se mostrarán cuando exista una forma real
 *   de saber "qué no ha visto este usuario" (por ahora no aplica).
 */
export async function getBadges(userId?: string | null): Promise<{
  chat_has_unseen: boolean;
}> {
  if (!isSupabaseConfigured() || !userId) {
    return { chat_has_unseen: false };
  }
  const supabase = createSupabaseServer();
  const { count } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("member_id", userId)
    .eq("is_admin_reply", true)
    .eq("read_by_member", false);
  return { chat_has_unseen: (count ?? 0) > 0 };
}

/** Próximos N eventos del calendario, ordenados por fecha. */
export async function getUpcomingCalendarEvents(
  limit = 2
): Promise<CalendarEvent[]> {
  const all = await getCalendarEvents();
  const today = new Date();
  const todayKey =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const future = all
    .filter((e) => e.year * 10000 + e.month * 100 + e.day >= todayKey)
    .sort(
      (a, b) =>
        a.year * 10000 + a.month * 100 + a.day -
        (b.year * 10000 + b.month * 100 + b.day)
    );
  return future.slice(0, limit);
}

// ─── Vista unificada del calendario ─────────────────────────────
//
// Fusiona calendar_events + Fiestas (y, a futuro, Días Sagrados) en
// una sola lista cronológica. La RLS controla qué ve cada rol:
//   - miembros (no admin) ven solo Fiestas published/in_progress
//   - admins ven todo en su localidad
//
// Para una Fiesta, la fecha que se usa en la vista es la de
// celebración (la noche anterior a la fecha oficial), porque es
// cuando los miembros efectivamente concurren.

export type UnifiedCalendarItem = {
  id: string;
  source: "calendar_event" | "feast";
  href: string;           // ruta pública (vista de miembro)
  adminHref: string;      // ruta de edición admin
  day: number;
  month: number;
  year: number;
  title: string;
  time: string;
  kind: import("./calendar-kinds").CalendarEventKind;
  color: string;          // color visual efectivo
  location: string | null;
  image_url: string | null;
  /** true para Días Sagrados auto-sembrados (no borrables). */
  isSystemSeeded: boolean;
  /** Solo para Fiestas; null en eventos del calendario. */
  feastStatus: import("./types").FeastStatus | null;
};

export async function getUnifiedCalendarItems(): Promise<UnifiedCalendarItem[]> {
  const [events, feasts] = await Promise.all([getCalendarEvents(), getFeasts()]);

  // Para enriquecer la tarjeta de cada Fiesta con horario y lugar,
  // traemos también las feast_locations cargadas por la Asamblea.
  // Usamos la PRIMERA location en orden cronológico como representante
  // en el calendario; si hay más de una, lo indicamos con "+N más".
  type FeastLoc = {
    feast_id: string;
    name: string | null;
    starts_at: string;
  };
  let locationsByFeast = new Map<string, FeastLoc[]>();
  if (isSupabaseConfigured() && feasts.length > 0) {
    const supabase = createSupabaseServer();
    const { data: locs } = await supabase
      .from("feast_locations")
      .select("feast_id, name, starts_at")
      .in("feast_id", feasts.map((f) => f.id))
      .order("starts_at", { ascending: true });
    for (const row of (locs ?? []) as FeastLoc[]) {
      const arr = locationsByFeast.get(row.feast_id) ?? [];
      arr.push(row);
      locationsByFeast.set(row.feast_id, arr);
    }
  }

  const fromEvents: UnifiedCalendarItem[] = events.map((e) => ({
    id: e.id,
    source: "calendar_event",
    href: `/calendario/${e.id}`,
    adminHref: `/admin/calendario/${e.id}`,
    day: e.day,
    month: e.month,
    year: e.year,
    title: e.title,
    time: e.time,
    kind: e.kind ?? "actividad_general",
    color: effectiveEventColor(e.kind, e.color),
    location: e.location ?? null,
    image_url: e.image_url ?? null,
    isSystemSeeded: e.is_system_seeded === true,
    feastStatus: null,
  }));

  const fromFeasts: UnifiedCalendarItem[] = feasts
    .filter((f) => f.gregorian_date)
    .map((f) => {
      const locs = locationsByFeast.get(f.id) ?? [];
      const firstLoc = locs[0];

      // Si la Asamblea cargó al menos una location, usamos su fecha/hora
      // como referencia (puede no ser exactamente la noche anterior si
      // la celebración la mueven). Sino, fallback a noche anterior + "Al atardecer".
      let day: number, month: number, year: number, time: string;
      if (firstLoc) {
        const d = new Date(firstLoc.starts_at);
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
        time = d.toLocaleTimeString("es-MX", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } else {
        const celebrationIso = celebrationDateFor(f.gregorian_date!);
        const parts = celebrationIso.split("-").map((n) => parseInt(n, 10));
        year = parts[0];
        month = parts[1];
        day = parts[2];
        time = "Al atardecer";
      }

      const locationLabel = firstLoc?.name
        ? locs.length > 1
          ? `${firstLoc.name} (+${locs.length - 1})`
          : firstLoc.name
        : null;

      return {
        id: f.id,
        source: "feast",
        href: `/fiestas/${f.id}`,
        adminHref: `/admin/fiestas/${f.id}`,
        day,
        month,
        year,
        title: `Fiesta de ${f.bahai_month_name}`,
        time,
        kind: "fiesta_19_dias",
        color: CALENDAR_KINDS.fiesta_19_dias.color,
        location: locationLabel,
        image_url: null,
        isSystemSeeded: true,
        feastStatus: f.status,
      } as UnifiedCalendarItem;
    });

  return [...fromEvents, ...fromFeasts].sort(
    (a, b) =>
      a.year * 10000 + a.month * 100 + a.day -
      (b.year * 10000 + b.month * 100 + b.day)
  );
}
