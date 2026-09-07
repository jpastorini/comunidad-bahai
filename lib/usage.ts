/**
 * Informe de uso de la app por localidad (migración 049).
 *
 * Los agregados los hace la base (usage_by_section / usage_by_day /
 * usage_by_person, security invoker: la RLS ya acota a la localidad de
 * quien pregunta). Acá se cruzan con los perfiles activos de la
 * localidad, las suscripciones push y la fecha de instalación, y se
 * arman los bloques que muestra /admin/uso.
 */

import { getBahaiYearCalendar, getCurrentBahaiYear } from "./bahai-calendar";
import { civilDateISO } from "./citas";
import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import { usageSectionLabel } from "./usage-sections";

export type UsageRange = { from: string; to: string };

const DAY_MS = 86_400_000;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Cantidad de días del rango, ambos extremos incluidos. */
export function rangeDays(r: UsageRange): number {
  const a = new Date(`${r.from}T00:00:00Z`).getTime();
  const b = new Date(`${r.to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / DAY_MS) + 1);
}

/** El mes bahá'í que contiene `today`, o null si el calendario no lo cubre. */
function currentBahaiMonthRange(today: string): (UsageRange & { label: string }) | null {
  const year = getCurrentBahaiYear(new Date(`${today}T12:00:00Z`));
  if (!year) return null;
  const cal = getBahaiYearCalendar(year);
  if (!cal) return null;
  const feasts = [...cal.feasts].sort((a, b) => a.monthIndex - b.monthIndex);
  const nextNawRuz = getBahaiYearCalendar(year + 1)?.nawRuz;
  for (let i = 0; i < feasts.length; i++) {
    const from = feasts[i].date;
    const nextStart = feasts[i + 1]?.date ?? nextNawRuz;
    if (!nextStart) return null;
    const to = addDays(nextStart, -1);
    if (today >= from && today <= to) {
      return { from, to, label: `Este mes bahá'í` };
    }
  }
  return null;
}

export type UsagePreset = { key: string; label: string; from: string; to: string };

/** Atajos del selector de rango. Hoy es el día civil de la app. */
export function usagePresets(today: string = civilDateISO()): UsagePreset[] {
  const out: UsagePreset[] = [
    { key: "7d", label: "Últimos 7 días", from: addDays(today, -6), to: today },
    { key: "30d", label: "Últimos 30 días", from: addDays(today, -29), to: today },
  ];
  const month = currentBahaiMonthRange(today);
  if (month) out.push({ key: "mes", label: month.label, from: month.from, to: month.to });
  out.push({ key: "90d", label: "Últimos 90 días", from: addDays(today, -89), to: today });
  return out;
}

/**
 * Rango pedido por la URL (?from=&to=), saneado: fechas válidas, en
 * orden, y nunca más de un año. Sin parámetros, los últimos 30 días.
 */
export function resolveUsageRange(
  params: { from?: string; to?: string },
  today: string = civilDateISO()
): UsageRange {
  let from = isIsoDate(params.from) ? params.from : addDays(today, -29);
  let to = isIsoDate(params.to) ? params.to : today;
  if (to > today) to = today;
  if (from > to) [from, to] = [to, from];
  if (rangeDays({ from, to }) > 366) from = addDays(to, -365);
  return { from, to };
}

// ─── El informe ────────────────────────────────────────────────────

export type RegularityKey = "diario" | "frecuente" | "semanal" | "esporadico" | "nunca";

export const REGULARITY_LABELS: Record<RegularityKey, string> = {
  diario: "Casi todos los días",
  frecuente: "Varias veces por semana",
  semanal: "Una vez por semana",
  esporadico: "Alguna vez",
  nunca: "No entró en el período",
};

export function regularityFor(activeDays: number, days: number): RegularityKey {
  if (activeDays <= 0) return "nunca";
  const ratio = activeDays / days;
  if (ratio >= 0.8) return "diario";
  if (ratio >= 3 / 7) return "frecuente";
  if (ratio >= 1 / 7) return "semanal";
  return "esporadico";
}

export type UsagePerson = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_bahai: boolean;
  active_days: number;
  hits: number;
  /** Último día con actividad dentro del rango. */
  last_day: string | null;
  /** Última entrada a la app, dentro o fuera del rango (048). */
  last_seen_at: string | null;
  installed: boolean;
  push: boolean;
  regularity: RegularityKey;
};

export type UsageReport = {
  range: UsageRange;
  days: number;
  summary: {
    total: number;
    installed: number;
    withPush: number;
    /** Entraron al menos un día del rango. */
    active: number;
    /** Nunca abrieron la app, en ningún momento. */
    never: number;
  };
  regularity: Array<{ key: RegularityKey; label: string; count: number }>;
  sections: Array<{ key: string; label: string; hits: number; people: number }>;
  byDay: Array<{ day: string; people: number; hits: number }>;
  people: UsagePerson[];
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_bahai: boolean;
  last_seen_at: string | null;
  pwa_installed_at: string | null;
};

export async function getUsageReport(
  localityId: string,
  range: UsageRange
): Promise<UsageReport | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const args = { p_from: range.from, p_to: range.to };

  const [profilesRes, sectionsRes, daysRes, peopleRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_bahai, last_seen_at, pwa_installed_at")
      .eq("locality_id", localityId)
      .is("disabled_at", null)
      .order("full_name", { ascending: true }),
    supabase.rpc("usage_by_section", args),
    supabase.rpc("usage_by_day", args),
    supabase.rpc("usage_by_person", args),
  ]);

  const firstError =
    profilesRes.error ?? sectionsRes.error ?? daysRes.error ?? peopleRes.error;
  if (firstError) {
    // Antes de la 049 no existen ni la columna ni las funciones.
    console.error("[usage] report:", firstError.message);
    return null;
  }

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const ids = new Set(profiles.map((p) => p.id));

  // Quién tiene push: la RLS de push_subscriptions solo deja ver las
  // propias, así que va con service-role, como getLocalityPushReach.
  const withPush = new Set<string>();
  const admin = createSupabaseAdmin();
  if (admin && profiles.length > 0) {
    const { data } = await admin
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", [...ids]);
    for (const r of (data ?? []) as Array<{ user_id: string }>) withPush.add(r.user_id);
  }

  const days = rangeDays(range);
  const byPerson = new Map<
    string,
    { active_days: number; hits: number; last_day: string | null }
  >();
  for (const r of (peopleRes.data ?? []) as Array<{
    profile_id: string;
    active_days: number | string;
    hits: number | string;
    last_day: string | null;
  }>) {
    byPerson.set(r.profile_id, {
      active_days: Number(r.active_days),
      hits: Number(r.hits),
      last_day: r.last_day,
    });
  }

  const people: UsagePerson[] = profiles.map((p) => {
    const u = byPerson.get(p.id);
    const active = u?.active_days ?? 0;
    return {
      id: p.id,
      full_name: p.full_name?.trim() || "Sin nombre",
      avatar_url: p.avatar_url,
      is_bahai: p.is_bahai,
      active_days: active,
      hits: u?.hits ?? 0,
      last_day: u?.last_day ?? null,
      last_seen_at: p.last_seen_at,
      installed: Boolean(p.pwa_installed_at),
      push: withPush.has(p.id),
      regularity: regularityFor(active, days),
    };
  });
  // De menos a más activa: la lista de a quién acompañar arriba.
  people.sort(
    (a, b) =>
      a.active_days - b.active_days ||
      (a.last_seen_at ?? "").localeCompare(b.last_seen_at ?? "") ||
      a.full_name.localeCompare(b.full_name)
  );

  const regularityOrder: RegularityKey[] = [
    "diario",
    "frecuente",
    "semanal",
    "esporadico",
    "nunca",
  ];
  const regularity = regularityOrder.map((key) => ({
    key,
    label: REGULARITY_LABELS[key],
    count: people.filter((p) => p.regularity === key).length,
  }));

  // Solo cuenta el uso de la audiencia vigente: quien se fue de la
  // localidad o quedó deshabilitado no infla las secciones.
  const sections = ((sectionsRes.data ?? []) as Array<{
    section: string;
    hits: number | string;
    people: number | string;
  }>).map((s) => ({
    key: s.section,
    label: usageSectionLabel(s.section),
    hits: Number(s.hits),
    people: Number(s.people),
  }));

  const dayMap = new Map<string, { people: number; hits: number }>();
  for (const d of (daysRes.data ?? []) as Array<{
    day: string;
    people: number | string;
    hits: number | string;
  }>) {
    dayMap.set(d.day, { people: Number(d.people), hits: Number(d.hits) });
  }
  const byDay: UsageReport["byDay"] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(range.from, i);
    const v = dayMap.get(day);
    byDay.push({ day, people: v?.people ?? 0, hits: v?.hits ?? 0 });
  }

  return {
    range,
    days,
    summary: {
      total: people.length,
      installed: people.filter((p) => p.installed).length,
      withPush: people.filter((p) => p.push).length,
      active: people.filter((p) => p.active_days > 0).length,
      never: people.filter((p) => !p.last_seen_at && p.active_days === 0).length,
    },
    regularity,
    sections,
    byDay,
    people,
  };
}
