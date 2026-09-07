/**
 * Lectura de comunicados (migración 048).
 *
 * Dos lados de la misma tabla `message_reads`:
 *   · el creyente lee SUS filas para saber qué le falta ver y qué
 *     confirmó (badge "Nuevo" por persona, estado del botón);
 *   · la Asamblea lee las de su localidad y las cruza con la audiencia
 *     del comunicado para saber a quién contactar por otro medio.
 *
 * Todo pasa por el cliente con cookies: la RLS decide quién ve qué.
 * `profiles` se lee con `using (true)`, así que los nombres salen sin
 * service-role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { Message, MessageRead } from "./types";

/** Lecturas del usuario actual, indexadas por comunicado. */
export async function getMyMessageReads(
  userId: string,
  messageIds: string[]
): Promise<Map<string, MessageRead>> {
  const map = new Map<string, MessageRead>();
  if (!isSupabaseConfigured() || messageIds.length === 0) return map;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("message_reads")
    .select("message_id, profile_id, seen_at, confirmed_at")
    .eq("profile_id", userId)
    .in("message_id", messageIds);
  if (error) {
    // Antes de la 048 la tabla no existe: el listado tiene que seguir
    // saliendo, solo que sin estado de lectura.
    console.error("[message-reads] getMyMessageReads:", error.message);
    return map;
  }
  for (const r of (data ?? []) as MessageRead[]) map.set(r.message_id, r);
  return map;
}

/** Cuántos días desde la publicación se sigue mostrando "Nuevo" a quien no lo vio. */
export const NEW_BADGE_DAYS = 30;

/**
 * "Nuevo" por persona: no lo vio todavía y el comunicado es reciente.
 * El tope de días evita que, al estrenar la función, toda la lista
 * histórica aparezca como nueva para todo el mundo.
 */
export function isNewForReader(m: Message, read: MessageRead | undefined): boolean {
  if (read) return false;
  const ageMs = Date.now() - new Date(m.date).getTime();
  return ageMs < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Informe para la Asamblea ─────────────────────────────────────

export type ReadCounts = {
  /** Personas a las que va dirigido el comunicado (creyentes, o todos). */
  total: number;
  /** Lo tuvieron en pantalla (incluye a quienes confirmaron). */
  seen: number;
  /** Tocaron "Enterado/a". */
  confirmed: number;
};

type AudienceProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_bahai: boolean;
  last_seen_at: string | null;
};

async function getAudience(
  supabase: SupabaseClient,
  localityId: string
): Promise<AudienceProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, is_bahai, last_seen_at")
    .eq("locality_id", localityId)
    .is("disabled_at", null)
    .order("full_name", { ascending: true });
  if (error) {
    console.error("[message-reads] getAudience:", error.message);
    return [];
  }
  return (data ?? []) as AudienceProfile[];
}

function audienceFor(m: Message, all: AudienceProfile[]): AudienceProfile[] {
  return m.audience === "todos" ? all : all.filter((p) => p.is_bahai);
}

/**
 * Conteos por comunicado para la tabla del panel. Una consulta de
 * lecturas para todos los comunicados y una de perfiles; el resto es
 * memoria. `null` si la tabla todavía no existe (antes de la 048).
 */
export async function getReadCountsForMessages(
  messages: Message[],
  localityId: string
): Promise<Map<string, ReadCounts> | null> {
  const out = new Map<string, ReadCounts>();
  if (!isSupabaseConfigured() || messages.length === 0) return out;
  const supabase = createSupabaseServer();
  const [audience, readsRes] = await Promise.all([
    getAudience(supabase, localityId),
    supabase
      .from("message_reads")
      .select("message_id, profile_id, confirmed_at")
      .in(
        "message_id",
        messages.map((m) => m.id)
      ),
  ]);
  if (readsRes.error) {
    console.error("[message-reads] counts:", readsRes.error.message);
    return null;
  }
  const reads = (readsRes.data ?? []) as Array<{
    message_id: string;
    profile_id: string;
    confirmed_at: string | null;
  }>;
  for (const m of messages) {
    const target = audienceFor(m, audience);
    const targetIds = new Set(target.map((p) => p.id));
    let seen = 0;
    let confirmed = 0;
    for (const r of reads) {
      // Solo cuenta la audiencia vigente: alguien que se fue de la
      // localidad o quedó deshabilitado no infla el numerador.
      if (r.message_id !== m.id || !targetIds.has(r.profile_id)) continue;
      seen++;
      if (r.confirmed_at) confirmed++;
    }
    out.set(m.id, { total: target.length, seen, confirmed });
  }
  return out;
}

export type ReadReportPerson = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  seen_at: string | null;
  confirmed_at: string | null;
  /** Última vez que abrió la app (cualquier pantalla), a lo sumo una marca por día. */
  last_seen_at: string | null;
};

export type ReadReport = {
  counts: ReadCounts;
  /** Confirmaron con el botón. */
  confirmed: ReadReportPerson[];
  /** Lo vieron en pantalla pero no confirmaron (o el comunicado no lo pedía). */
  seen: ReadReportPerson[];
  /** Ni lo vieron: la lista para contactar por otro medio. */
  pending: ReadReportPerson[];
};

/**
 * El informe de un comunicado: quién confirmó, quién solo lo vio y quién
 * no lo vio, con su última entrada a la app. Los que no vieron van
 * ordenados por última entrada ascendente: primero quien hace más tiempo
 * no entra, que es a quien hay que llamar.
 */
export async function getReadReport(
  m: Message,
  localityId: string
): Promise<ReadReport | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const [all, readsRes] = await Promise.all([
    getAudience(supabase, localityId),
    supabase
      .from("message_reads")
      .select("message_id, profile_id, seen_at, confirmed_at")
      .eq("message_id", m.id),
  ]);
  if (readsRes.error) {
    console.error("[message-reads] report:", readsRes.error.message);
    return null;
  }
  const byProfile = new Map<string, MessageRead>();
  for (const r of (readsRes.data ?? []) as MessageRead[]) byProfile.set(r.profile_id, r);

  const confirmed: ReadReportPerson[] = [];
  const seen: ReadReportPerson[] = [];
  const pending: ReadReportPerson[] = [];
  for (const p of audienceFor(m, all)) {
    const r = byProfile.get(p.id);
    const person: ReadReportPerson = {
      id: p.id,
      full_name: p.full_name?.trim() || "Sin nombre",
      avatar_url: p.avatar_url,
      seen_at: r?.seen_at ?? null,
      confirmed_at: r?.confirmed_at ?? null,
      last_seen_at: p.last_seen_at,
    };
    if (r?.confirmed_at) confirmed.push(person);
    else if (r) seen.push(person);
    else pending.push(person);
  }
  const byTime = (k: "confirmed_at" | "seen_at") => (a: ReadReportPerson, b: ReadReportPerson) =>
    (b[k] ?? "").localeCompare(a[k] ?? "");
  confirmed.sort(byTime("confirmed_at"));
  seen.sort(byTime("seen_at"));
  // Nunca entró primero (null), después del más antiguo al más reciente.
  pending.sort((a, b) => (a.last_seen_at ?? "").localeCompare(b.last_seen_at ?? ""));

  return {
    counts: {
      total: confirmed.length + seen.length + pending.length,
      seen: confirmed.length + seen.length,
      confirmed: confirmed.length,
    },
    confirmed,
    seen,
    pending,
  };
}

/**
 * "hace 3 días", "hoy", "nunca". Para la columna "Última vez en la app":
 * lo que importa es el orden de magnitud, no la hora.
 */
export function formatSinceDays(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Nunca entró";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Hace un mes" : `Hace ${months} meses`;
}
