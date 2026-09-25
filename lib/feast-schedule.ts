import { celebrationDateFor } from "./bahai-calendar";

/**
 * Cuándo se celebra una Fiesta de los 19 Días, en fecha CIVIL.
 *
 * Una sola fuente para el calendario unificado (lib/data.ts) y para los
 * recordatorios por push (lib/reminders.ts): si cada uno lo calculara por
 * su cuenta, el aviso podría decir un día y la pantalla otro.
 *
 * La regla: si la Asamblea cargó al menos un lugar, manda la fecha y hora
 * de ese lugar —la celebración puede ser cualquier día del mes bahá'í, no
 * necesariamente la víspera—. Si no cargó ninguno, la víspera del día 1 del
 * mes (`celebrationDateFor`), que es cuando la comunidad se junta porque el
 * día bahá'í empieza al atardecer.
 */

/** Zona horaria civil de la comunidad. */
const TZ = process.env.APP_TIMEZONE || "America/Montevideo";

export type FeastCelebration = {
  /** Fecha civil de la celebración, ISO YYYY-MM-DD. */
  date: string;
  /** Etiqueta de hora: "19:00" o "Al atardecer" si no hay lugar. */
  time: string;
  /** true si sale de un lugar cargado por la Asamblea. */
  scheduled: boolean;
};

/**
 * @param gregorianDate fecha oficial del día 1 del mes bahá'í (ISO).
 * @param startsAt      `starts_at` del primer lugar cargado, o null.
 */
export function feastCelebration(
  gregorianDate: string,
  startsAt?: string | null
): FeastCelebration {
  if (startsAt) {
    const at = new Date(startsAt);
    if (!Number.isNaN(at.getTime())) {
      return {
        date: civilDate(at),
        time: civilTime(at),
        scheduled: true,
      };
    }
  }
  return {
    date: celebrationDateFor(gregorianDate),
    time: "Al atardecer",
    scheduled: false,
  };
}

/**
 * Fecha civil de un instante en la zona de la comunidad. ⚠️ No usar
 * `getFullYear()` y compañía: las funciones de Vercel corren en UTC, así
 * que una Fiesta a las 21:00 de Montevideo caería al día siguiente.
 */
function civilDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function civilTime(at: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}
