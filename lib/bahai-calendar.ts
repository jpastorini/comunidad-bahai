/**
 * Calendario bahá'í — datos estáticos.
 * Los 19 meses del año bahá'í (cada uno de 19 días).
 * El año empieza en Naw-Rúz (~21 de marzo).
 */

export type BahaiMonth = {
  index: number;          // 1..19
  name: string;           // transliteración estándar
  meaning: string;        // significado en español
};

export const BAHAI_MONTHS: BahaiMonth[] = [
  { index: 1,  name: "Bahá",      meaning: "Esplendor" },
  { index: 2,  name: "Jalál",     meaning: "Gloria" },
  { index: 3,  name: "Jamál",     meaning: "Belleza" },
  { index: 4,  name: "ʻAẓamat",   meaning: "Grandeza" },
  { index: 5,  name: "Núr",       meaning: "Luz" },
  { index: 6,  name: "Raḥmat",    meaning: "Misericordia" },
  { index: 7,  name: "Kalimát",   meaning: "Palabras" },
  { index: 8,  name: "Kamál",     meaning: "Perfección" },
  { index: 9,  name: "Asmáʼ",     meaning: "Nombres" },
  { index: 10, name: "ʻIzzat",    meaning: "Poderío" },
  { index: 11, name: "Mashíyyat", meaning: "Voluntad" },
  { index: 12, name: "ʻIlm",      meaning: "Conocimiento" },
  { index: 13, name: "Qudrat",    meaning: "Poder" },
  { index: 14, name: "Qawl",      meaning: "Palabra" },
  { index: 15, name: "Masáʼil",   meaning: "Preguntas" },
  { index: 16, name: "Sharaf",    meaning: "Honor" },
  { index: 17, name: "Sulṭán",    meaning: "Soberanía" },
  { index: 18, name: "Mulk",      meaning: "Dominio" },
  { index: 19, name: "ʻAláʼ",     meaning: "Loftiness" },
];

export function getBahaiMonth(index: number): BahaiMonth | undefined {
  return BAHAI_MONTHS.find((m) => m.index === index);
}

/** Año bahá'í actual aproximado a partir del año gregoriano.
 *  El año 1 BE inició en 1844-03-21. */
export function approximateBahaiYear(gregorianYear: number): number {
  return gregorianYear - 1843;
}

// ─────────────────────────────────────────────────────────────────
// Fechas oficiales del calendario bahá'í
//
// Las fechas son las fechas gregorianas oficiales en las que comienza
// cada mes bahá'í (día 1 de ese mes), tal como las publica la Casa
// Universal de Justicia en https://www.bahai.org/es/action/devotional-life/calendar
//
// La Fiesta se CELEBRA la noche anterior (atardecer del día previo).
// Por ejemplo: si la fecha oficial es 2026-03-20, la Fiesta se vive
// el atardecer del 19 de marzo de 2026.
//
// IMPORTANTE: cuando se acerque el final del rango aquí cargado,
// actualizar agregando los años siguientes. Verificar las fechas en
// el sitio oficial — varían año a año según el equinoccio en Teherán.
// ─────────────────────────────────────────────────────────────────

export type BahaiYearCalendar = {
  bahaiYear: number;
  nawRuz: string; // YYYY-MM-DD — fecha oficial del Día 1 del Mes 1 (Bahá)
  feasts: { monthIndex: number; date: string }[]; // 19 entradas, día 1 oficial de cada mes
};

export const BAHAI_CALENDAR_YEARS: BahaiYearCalendar[] = [
  {
    bahaiYear: 183,
    nawRuz: "2026-03-20",
    feasts: [
      { monthIndex: 1,  date: "2026-03-20" },
      { monthIndex: 2,  date: "2026-04-08" },
      { monthIndex: 3,  date: "2026-04-27" },
      { monthIndex: 4,  date: "2026-05-16" },
      { monthIndex: 5,  date: "2026-06-04" },
      { monthIndex: 6,  date: "2026-06-23" },
      { monthIndex: 7,  date: "2026-07-12" },
      { monthIndex: 8,  date: "2026-07-31" },
      { monthIndex: 9,  date: "2026-08-19" },
      { monthIndex: 10, date: "2026-09-07" },
      { monthIndex: 11, date: "2026-09-26" },
      { monthIndex: 12, date: "2026-10-15" },
      { monthIndex: 13, date: "2026-11-03" },
      { monthIndex: 14, date: "2026-11-22" },
      { monthIndex: 15, date: "2026-12-11" },
      { monthIndex: 16, date: "2026-12-30" },
      { monthIndex: 17, date: "2027-01-18" },
      { monthIndex: 18, date: "2027-02-06" },
      { monthIndex: 19, date: "2027-03-02" },
    ],
  },
  {
    bahaiYear: 184,
    nawRuz: "2027-03-21",
    feasts: [
      { monthIndex: 1,  date: "2027-03-21" },
      { monthIndex: 2,  date: "2027-04-09" },
      { monthIndex: 3,  date: "2027-04-28" },
      { monthIndex: 4,  date: "2027-05-17" },
      { monthIndex: 5,  date: "2027-06-05" },
      { monthIndex: 6,  date: "2027-06-24" },
      { monthIndex: 7,  date: "2027-07-13" },
      { monthIndex: 8,  date: "2027-08-01" },
      { monthIndex: 9,  date: "2027-08-20" },
      { monthIndex: 10, date: "2027-09-08" },
      { monthIndex: 11, date: "2027-09-27" },
      { monthIndex: 12, date: "2027-10-16" },
      { monthIndex: 13, date: "2027-11-04" },
      { monthIndex: 14, date: "2027-11-23" },
      { monthIndex: 15, date: "2027-12-12" },
      { monthIndex: 16, date: "2027-12-31" },
      { monthIndex: 17, date: "2028-01-19" },
      { monthIndex: 18, date: "2028-02-07" },
      { monthIndex: 19, date: "2028-03-01" },
    ],
  },
  {
    bahaiYear: 185,
    nawRuz: "2028-03-20",
    feasts: [
      { monthIndex: 1,  date: "2028-03-20" },
      { monthIndex: 2,  date: "2028-04-08" },
      { monthIndex: 3,  date: "2028-04-27" },
      { monthIndex: 4,  date: "2028-05-16" },
      { monthIndex: 5,  date: "2028-06-04" },
      { monthIndex: 6,  date: "2028-06-23" },
      { monthIndex: 7,  date: "2028-07-12" },
      { monthIndex: 8,  date: "2028-07-31" },
      { monthIndex: 9,  date: "2028-08-19" },
      { monthIndex: 10, date: "2028-09-07" },
      { monthIndex: 11, date: "2028-09-26" },
      { monthIndex: 12, date: "2028-10-15" },
      { monthIndex: 13, date: "2028-11-03" },
      { monthIndex: 14, date: "2028-11-22" },
      { monthIndex: 15, date: "2028-12-11" },
      { monthIndex: 16, date: "2028-12-30" },
      { monthIndex: 17, date: "2029-01-18" },
      { monthIndex: 18, date: "2029-02-06" },
      { monthIndex: 19, date: "2029-03-01" },
    ],
  },
];

export function getBahaiYearCalendar(
  bahaiYear: number
): BahaiYearCalendar | undefined {
  return BAHAI_CALENDAR_YEARS.find((c) => c.bahaiYear === bahaiYear);
}

/**
 * Año bahá'í que contiene la fecha gregoriana dada.
 * Retorna null si la fecha cae fuera del rango cargado en BAHAI_CALENDAR_YEARS.
 */
export function getCurrentBahaiYear(today: Date = new Date()): number | null {
  const iso = isoDate(today);
  const sorted = [...BAHAI_CALENDAR_YEARS].sort(
    (a, b) => a.bahaiYear - b.bahaiYear
  );
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (iso >= cur.nawRuz && (!next || iso < next.nawRuz)) {
      return cur.bahaiYear;
    }
  }
  return null;
}

/**
 * Fecha de celebración de una Fiesta o Día Sagrado: la noche anterior
 * a la fecha oficial (atardecer del día previo según calendario gregoriano).
 * Retorna ISO YYYY-MM-DD.
 */
export function celebrationDateFor(officialDateIso: string): string {
  const d = new Date(`${officialDateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return isoDate(d);
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
