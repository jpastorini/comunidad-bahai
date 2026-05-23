import {
  computeHolyDayCelebration,
  getHolyDayDatesForYear,
  HOLY_DAYS,
} from "./bahai-calendar";
import { CALENDAR_KINDS } from "./calendar-kinds";
import { createSupabaseServer } from "./supabase/server";

/**
 * Idempotente. Inserta los 11 Días Sagrados del año Badí' indicado
 * para la localidad indicada, si todavía no existen. Los Días
 * Sagrados se almacenan como filas en `calendar_events` con
 * is_system_seeded=true y system_id estable (ej. 'holy_naw_ruz_BE183').
 *
 * - day/month/year guardan la fecha de CELEBRACIÓN (lo que el miembro
 *   ve en el calendario): noche anterior a la oficial, salvo los 3
 *   con horario exacto que usan la fecha oficial.
 * - official_date guarda la fecha oficial del calendario Badí'.
 * - time guarda "Al atardecer" o el horario exacto ("12:00 (mediodía)").
 * - kind diferencia visualmente con/sin suspensión de trabajo.
 */
export async function ensureHolyDaysSeeded(
  localityId: string,
  bahaiYear: number
): Promise<{ seeded: number; error: string | null }> {
  const supabase = createSupabaseServer();

  const calendar = getHolyDayDatesForYear(bahaiYear);
  if (!calendar) {
    return { seeded: 0, error: `no holy day dates for BE ${bahaiYear}` };
  }

  const expectedIds = HOLY_DAYS.map((h) => systemId(h.id, bahaiYear));

  // Chequear cuáles ya existen para esta localidad+año.
  const { data: existing, error: countError } = await supabase
    .from("calendar_events")
    .select("system_id")
    .eq("locality_id", localityId)
    .in("system_id", expectedIds);

  if (countError) {
    console.error("[ensureHolyDaysSeeded] count error:", countError);
    return { seeded: 0, error: `count: ${countError.message}` };
  }

  const existingIds = new Set((existing ?? []).map((r) => r.system_id));
  if (existingIds.size >= HOLY_DAYS.length) {
    return { seeded: 0, error: null };
  }

  const rows = HOLY_DAYS.filter(
    (h) => !existingIds.has(systemId(h.id, bahaiYear))
  )
    .map((h) => {
      const officialIso = calendar.dates[h.id];
      if (!officialIso) return null;

      const { date: celebrationIso, time } = computeHolyDayCelebration(
        officialIso,
        h.rule
      );
      const [year, month, day] = celebrationIso
        .split("-")
        .map((n) => parseInt(n, 10));

      const kind = h.workSuspended
        ? "dia_sagrado_no_trabajo"
        : "dia_sagrado_con_trabajo";

      return {
        day,
        month,
        year,
        title: h.name,
        time,
        color: CALENDAR_KINDS[kind].color,
        kind,
        description: h.description,
        location: null as string | null,
        image_url: null as string | null,
        duration_minutes: 60,
        is_system_seeded: true,
        system_id: systemId(h.id, bahaiYear),
        official_date: officialIso,
        locality_id: localityId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return { seeded: 0, error: null };

  const { data, error: insertError } = await supabase
    .from("calendar_events")
    .upsert(rows, {
      onConflict: "locality_id,system_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) {
    console.error("[ensureHolyDaysSeeded] insert error:", insertError);
    return { seeded: 0, error: `insert: ${insertError.message}` };
  }

  return { seeded: data?.length ?? 0, error: null };
}

function systemId(holyDayId: string, bahaiYear: number): string {
  return `holy_${holyDayId}_BE${bahaiYear}`;
}
