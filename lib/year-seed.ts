import { getBahaiYearCalendar, getCurrentBahaiYear } from "./bahai-calendar";
import { ensureFeastsSeeded } from "./feasts";
import { ensureHolyDaysSeeded } from "./holy-days";

export type YearSeedResult = {
  year: number | null;
  feastsSeeded: number;
  holyDaysSeeded: number;
  errors: string[];
};

/**
 * Siembra para una localidad lo que falte del año Badí' actual (y
 * del próximo si ya pasó la mitad del año). Incluye Fiestas y Días
 * Sagrados. Idempotente — se puede llamar en cada page load del
 * panel admin sin temor a duplicados.
 */
export async function ensureYearSeeded(
  localityId: string,
  today: Date = new Date()
): Promise<YearSeedResult> {
  const currentYear = getCurrentBahaiYear(today);
  if (currentYear == null) {
    return {
      year: null,
      feastsSeeded: 0,
      holyDaysSeeded: 0,
      errors: ["no bahai year for today"],
    };
  }

  const errors: string[] = [];
  let feastsSeeded = 0;
  let holyDaysSeeded = 0;

  const seedYear = async (y: number) => {
    const f = await ensureFeastsSeeded(localityId, y);
    if (f.error) errors.push(`feasts BE${y}: ${f.error}`);
    feastsSeeded += f.seeded;

    const h = await ensureHolyDaysSeeded(localityId, y);
    if (h.error) errors.push(`holy days BE${y}: ${h.error}`);
    holyDaysSeeded += h.seeded;
  };

  await seedYear(currentYear);

  // Si pasamos el Mes 10 del año Badí' actual, sembrar también el siguiente.
  const currentCal = getBahaiYearCalendar(currentYear);
  const nextCal = getBahaiYearCalendar(currentYear + 1);
  if (currentCal && nextCal) {
    const midpoint = currentCal.feasts[9]?.date;
    const todayIso = isoDate(today);
    if (midpoint && todayIso >= midpoint) {
      await seedYear(currentYear + 1);
    }
  }

  return { year: currentYear, feastsSeeded, holyDaysSeeded, errors };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
