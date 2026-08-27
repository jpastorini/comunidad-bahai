import {
  BAHAI_MONTHS,
  getBahaiYearCalendar,
  getHolyDayDatesForYear,
} from "./bahai-calendar";

/**
 * El año administrativo de la Tesorería.
 *
 * OJO con la distinción, que es la fuente de todos los errores de un día
 * o de un mes en esta parte del código:
 *
 *  · El año bahá'í del CALENDARIO empieza en Naw-Rúz (~21 de marzo). Es
 *    el que rige las Fiestas y los Días Sagrados, y es el que usa
 *    `getCurrentBahaiYear()` en lib/bahai-calendar.ts.
 *
 *  · El año ADMINISTRATIVO —el ejercicio contable de la Asamblea, que se
 *    elige en Riḍván— empieza el PRIMER DÍA DE RIḌVÁN (13 de Jalál,
 *    ~21 de abril) y termina el día anterior al Riḍván siguiente.
 *
 * Los dos se llaman "183" y se solapan casi todo el año, pero difieren en
 * un mes en cada punta. Para la Tesorería manda el administrativo: los
 * saldos de apertura del libro 183 están fechados el 2026-04-21, que es
 * exactamente el primer día de Riḍván de ese año.
 *
 * Módulo sin queries a propósito, así lo puede importar un componente de
 * cliente sin arrastrar la capa de datos.
 */

// ─── Aritmética de fechas de calendario ──────────────────────────
// Siempre en UTC: acá una fecha es un día del calendario, no un
// instante, y usar la hora local mueve los bordes de mes.

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function previousDay(iso: string): string {
  return addDays(iso, -1);
}

/** Días entre dos fechas (b − a). Mismo día = 0. */
export function daysBetween(a: string, b: string): number {
  const ms =
    new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function clampDate(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

// ─── Bordes del ejercicio ────────────────────────────────────────

/**
 * Primer día del ejercicio contable: el primer día de Riḍván.
 *
 * Se toma de las fechas oficiales de Días Sagrados cuando están
 * cargadas; si no, se calcula como 13 de Jalál (el segundo mes bahá'í),
 * que es la definición en el calendario Badí'. Verificado: Jalál 183
 * abre el 2026-04-09, y 09 + 12 días = 2026-04-21, la fecha oficial.
 */
export function treasuryYearStart(bahaiYear: number): string | null {
  const official = getHolyDayDatesForYear(bahaiYear)?.dates.ridvan_1;
  if (official) return official;

  const jalal = getBahaiYearCalendar(bahaiYear)?.feasts.find(
    (f) => f.monthIndex === 2
  );
  return jalal ? addDays(jalal.date, 12) : null;
}

/** Último día del ejercicio: el día anterior al Riḍván siguiente. */
export function treasuryYearEnd(bahaiYear: number): string | null {
  const next = treasuryYearStart(bahaiYear + 1);
  if (next) return previousDay(next);

  // Sin datos del año siguiente cargados, se asume un año Badí' de 365
  // días. Es una aproximación de borde que solo aparece si el calendario
  // se quedó corto; conviene actualizar lib/bahai-calendar.ts.
  const start = treasuryYearStart(bahaiYear);
  return start ? addDays(start, 364) : null;
}

/** A qué ejercicio contable pertenece una fecha gregoriana. */
export function treasuryYearForDate(iso: string): number | null {
  // Se prueba alrededor del año bahá'í aproximado de esa fecha: el
  // ejercicio arranca en abril, así que el candidato es el año calendario
  // o el anterior.
  const approx = parseInt(iso.slice(0, 4), 10) - 1843;
  for (const candidate of [approx, approx - 1, approx + 1]) {
    const start = treasuryYearStart(candidate);
    const end = treasuryYearEnd(candidate);
    if (start && end && iso >= start && iso <= end) return candidate;
  }
  return null;
}

// ─── Los meses del ejercicio ─────────────────────────────────────

export type TreasuryMonth = {
  /** Clave estable, para React y para los mapas de agregados. */
  key: string;
  /** 1..19, el índice del mes bahá'í. */
  monthIndex: number;
  name: string;
  meaning: string;
  from: string;
  to: string;
  /** El ejercicio arranca y termina en mitad del mes de Jalál, así que
   *  el primer y el último tramo son parciales. */
  partial: boolean;
};

/**
 * Los meses bahá'ís del ejercicio, recortados a sus bordes.
 *
 * El ejercicio empieza el 13 de Jalál, así que el primer tramo y el
 * último son parciales y los dos se llaman Jalál (uno de cada año
 * calendario). Es raro de ver pero es la verdad del ejercicio.
 *
 * Cada tramo va desde el día 1 de un mes hasta el día anterior al mes
 * siguiente. Eso hace que **Mulk absorba los días de Ayyám-i-Há**, y es
 * a propósito: si los cuatro días intercalares quedaran afuera, un
 * aporte recibido en Ayyám-i-Há desaparecería de los gráficos.
 */
export function treasuryMonths(bahaiYear: number): TreasuryMonth[] {
  const start = treasuryYearStart(bahaiYear);
  const end = treasuryYearEnd(bahaiYear);
  if (!start || !end) return [];

  const raw: { monthIndex: number; year: number; from: string; to: string }[] =
    [];

  for (const year of [bahaiYear, bahaiYear + 1]) {
    const cal = getBahaiYearCalendar(year);
    if (!cal) continue;
    const feasts = [...cal.feasts].sort((a, b) => a.monthIndex - b.monthIndex);
    const nextNawRuz = getBahaiYearCalendar(year + 1)?.nawRuz;
    feasts.forEach((f, i) => {
      const nextStart = feasts[i + 1]?.date ?? nextNawRuz;
      if (!nextStart) return;
      raw.push({
        monthIndex: f.monthIndex,
        year,
        from: f.date,
        to: previousDay(nextStart),
      });
    });
  }

  return raw
    .filter((m) => m.to >= start && m.from <= end)
    .map((m) => {
      const from = m.from < start ? start : m.from;
      const to = m.to > end ? end : m.to;
      const month = BAHAI_MONTHS.find((b) => b.index === m.monthIndex);
      return {
        key: `${m.year}-${m.monthIndex}`,
        monthIndex: m.monthIndex,
        name: month?.name ?? `Mes ${m.monthIndex}`,
        meaning: month?.meaning ?? "",
        from,
        to,
        partial: from !== m.from || to !== m.to,
      };
    })
    .sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Cuánto del ejercicio transcurrió a una fecha, entre 0 y 1.
 *
 * Se mide en DÍAS, no en meses: la referencia tiene que poder caer en
 * mitad de un mes, que es donde uno la mira el 90 % de las veces.
 */
export function treasuryYearElapsed(
  bahaiYear: number,
  asOf: string
): { fraction: number; daysElapsed: number; daysTotal: number } | null {
  const start = treasuryYearStart(bahaiYear);
  const end = treasuryYearEnd(bahaiYear);
  if (!start || !end) return null;
  const daysTotal = daysBetween(start, end) + 1;
  const capped = clampDate(asOf, start, end);
  const daysElapsed = daysBetween(start, capped) + 1;
  return {
    fraction: Math.min(Math.max(daysElapsed / daysTotal, 0), 1),
    daysElapsed,
    daysTotal,
  };
}

/** Cuántos meses bahá'ís tiene el ejercicio. Es lo que divide el
 *  presupuesto para expresarlo "por mes". */
export function treasuryMonthCount(bahaiYear: number): number {
  const months = treasuryMonths(bahaiYear);
  // Los dos tramos parciales de Jalál suman uno entre los dos, así que
  // el ejercicio tiene 19 meses aunque la lista traiga 20 tramos.
  return months.length > 0 ? 19 : 0;
}
