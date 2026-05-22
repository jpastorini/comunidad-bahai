import {
  BAHAI_CALENDAR_YEARS,
  celebrationDateFor,
  getBahaiMonth,
  getBahaiYearCalendar,
  getCurrentBahaiYear,
} from "./bahai-calendar";
import { createSupabaseServer } from "./supabase/server";
import type { Feast, FeastStatus } from "./types";

/**
 * Idempotent: siembra las 19 Fiestas del año Badí' indicado para la
 * localidad indicada, si todavía no existen. Las inserta en estado
 * 'draft' (borrador). Si ya hay 19 Fiestas para esa combinación,
 * no hace nada.
 */
export async function ensureFeastsSeeded(
  localityId: string,
  bahaiYear: number
): Promise<void> {
  const supabase = createSupabaseServer();

  const { count } = await supabase
    .from("feasts")
    .select("id", { count: "exact", head: true })
    .eq("locality_id", localityId)
    .eq("bahai_year", bahaiYear);

  if ((count ?? 0) >= 19) return;

  const calendar = getBahaiYearCalendar(bahaiYear);
  if (!calendar) return;

  const rows = calendar.feasts.map((f) => {
    const month = getBahaiMonth(f.monthIndex);
    return {
      bahai_year: bahaiYear,
      bahai_month_index: f.monthIndex,
      bahai_month_name: month?.name ?? `Mes ${f.monthIndex}`,
      gregorian_date: f.date,
      status: "draft" as FeastStatus,
      locality_id: localityId,
    };
  });

  await supabase
    .from("feasts")
    .upsert(rows, {
      onConflict: "locality_id,bahai_year,bahai_month_index",
      ignoreDuplicates: true,
    });
}

/**
 * Siembra las Fiestas del año Badí' actual (según hoy) y, si ya
 * estamos en la segunda mitad del año, también del próximo, para
 * que la comunidad pueda anticipar.
 */
export async function ensureCurrentAndNextYearSeeded(
  localityId: string,
  today: Date = new Date()
): Promise<void> {
  const currentYear = getCurrentBahaiYear(today);
  if (currentYear == null) return;

  await ensureFeastsSeeded(localityId, currentYear);

  // Si pasó la mitad del año Badí' (Mes 10 aprox), sembrar también el siguiente.
  const currentCal = getBahaiYearCalendar(currentYear);
  const nextCal = getBahaiYearCalendar(currentYear + 1);
  if (currentCal && nextCal) {
    const midpoint = currentCal.feasts[9]?.date; // Mes 10 = ʻIzzat
    if (midpoint && isoToday(today) >= midpoint) {
      await ensureFeastsSeeded(localityId, currentYear + 1);
    }
  }
}

/**
 * Devuelve la próxima Fiesta a celebrar para la localidad: la
 * Fiesta cuya fecha oficial sea hoy o futura. Si todas pasaron,
 * la última disponible.
 */
export function selectCurrentFeast(
  feasts: Feast[],
  today: Date = new Date()
): Feast | null {
  const inProgress = feasts.find((f) => f.status === "in_progress");
  if (inProgress) return inProgress;

  const todayIso = isoToday(today);
  const sorted = [...feasts].sort((a, b) =>
    (a.gregorian_date ?? "").localeCompare(b.gregorian_date ?? "")
  );
  const upcoming = sorted.find(
    (f) =>
      (f.status === "published" || f.status === "draft") &&
      (f.gregorian_date ?? "9999-99-99") >= todayIso
  );
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}

function isoToday(today: Date): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export { celebrationDateFor, BAHAI_CALENDAR_YEARS };
