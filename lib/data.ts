/**
 * Data-access layer. Each function returns either rows from Supabase
 * (when configured) or seed data (for demo/offline).
 *
 * All functions are server-safe and async to make swapping to live data
 * a no-op for screens.
 */

import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import {
  seedActivities,
  seedBadges,
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

/** Próxima Fiesta a celebrar (la upcoming más cercana, o la in_progress). */
export async function getCurrentFeast(): Promise<Feast | null> {
  const all = await getFeasts();
  // Priorizar in_progress, luego la upcoming más reciente.
  const inProgress = all.find((f) => f.status === "in_progress");
  if (inProgress) return inProgress;
  return all.find((f) => f.status === "upcoming") ?? null;
}

export async function getBadges() {
  // Real implementation would compute unread counts; demo returns static.
  return seedBadges;
}
