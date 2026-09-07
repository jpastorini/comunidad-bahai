import { celebrationDateFor } from "./bahai-calendar";
import { getUnifiedCalendarItems, type UnifiedCalendarItem } from "./data";
import { getReadCountsForMessages, type ReadCounts } from "./message-reads";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import { todayISO } from "./treasury-ledger";
import type { Feast, Message } from "./types";

/**
 * Datos del Inicio del panel como tablero de ATENCIÓN: lo que hoy pide
 * que alguien haga algo, no cuántas filas hay en cada tabla. Cada función
 * devuelve lo mínimo para decidir (un número, un estado, una lista corta)
 * y falla en silencio a un valor neutro: el Inicio no puede romperse
 * porque una tabla todavía no existe.
 */

export type TasksSummary = {
  pending: number;
  /** Con fecha límite anterior a hoy y sin terminar. */
  overdue: number;
  /** Vencen en los próximos 7 días (hoy incluido). */
  dueSoon: number;
};

export async function getTasksSummary(): Promise<TasksSummary> {
  const empty = { pending: 0, overdue: 0, dueSoon: 0 };
  if (!isSupabaseConfigured()) return empty;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("assembly_tasks")
    .select("due_date")
    .eq("scope", "local")
    .neq("status", "hecha");
  if (error) {
    console.error("[admin-attention] tasks:", error.message);
    return empty;
  }
  const today = todayISO();
  const soon = addDaysISO(today, 7);
  let overdue = 0;
  let dueSoon = 0;
  for (const row of (data ?? []) as Array<{ due_date: string | null }>) {
    if (!row.due_date) continue;
    if (row.due_date < today) overdue++;
    else if (row.due_date <= soon) dueSoon++;
  }
  return { pending: data?.length ?? 0, overdue, dueSoon };
}

export type NextFeast = {
  feast: Pick<Feast, "id" | "bahai_month_name" | "bahai_year" | "status" | "gregorian_date">;
  /** Noche de la celebración (víspera de la fecha oficial), ISO. */
  celebrationDate: string;
  /** Días hasta la celebración; 0 es hoy, negativo si ya pasó y sigue en curso. */
  daysUntil: number;
};

/**
 * La próxima Fiesta sin importar su estado: la que está en borrador es
 * justamente la que pide atención (hay que publicarla). La celebración es
 * la víspera de la fecha oficial, así que una Fiesta cuya fecha oficial es
 * mañana se celebra hoy y sigue siendo "la próxima".
 */
export async function getNextFeast(): Promise<NextFeast | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const today = todayISO();
  const { data, error } = await supabase
    .from("feasts")
    .select("id, bahai_month_name, bahai_year, status, gregorian_date")
    .gte("gregorian_date", today)
    .order("gregorian_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[admin-attention] feast:", error.message);
    return null;
  }
  const feast = data as NextFeast["feast"];
  const celebrationDate = celebrationDateFor(feast.gregorian_date!);
  return { feast, celebrationDate, daysUntil: daysBetweenISO(today, celebrationDate) };
}

export type LatestComunicado = {
  message: Pick<Message, "id" | "title" | "date" | "audience" | "ask_confirmation">;
  /** null si la 048 no corrió todavía. */
  reads: ReadCounts | null;
};

export async function getLatestComunicadoWithReads(
  localityId: string
): Promise<LatestComunicado | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("messages")
    .select("id, title, date, audience, ask_confirmation")
    .eq("source", "asamblea_local")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[admin-attention] comunicado:", error.message);
    return null;
  }
  const message = data as LatestComunicado["message"];
  const counts = await getReadCountsForMessages([message as Message], localityId);
  return { message, reads: counts?.get(message.id) ?? null };
}

/** Eventos, Fiestas y Días Sagrados de hoy a `days` días adelante. */
export async function getWeekAhead(days = 7): Promise<UnifiedCalendarItem[]> {
  const items = await getUnifiedCalendarItems();
  const today = todayISO();
  const end = addDaysISO(today, days);
  return items.filter((it) => {
    const iso = `${it.year}-${pad2(it.month)}-${pad2(it.day)}`;
    return iso >= today && iso <= end;
  });
}

// ─── fechas ISO sin zona (YYYY-MM-DD), aritmética en UTC ───

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetweenISO(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map((n) => parseInt(n, 10));
  const [y2, m2, d2] = toIso.split("-").map((n) => parseInt(n, 10));
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
