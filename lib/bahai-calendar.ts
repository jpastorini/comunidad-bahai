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

// ─────────────────────────────────────────────────────────────────
// Días Sagrados (Holy Days)
//
// 11 conmemoraciones por año Badí'. 9 con suspensión de trabajo,
// 2 sin. La mayoría se celebra la noche anterior; tres tienen hora
// exacta (Martirio del Báb mediodía, Ascensión de Bahá'u'lláh 3 AM,
// Ascensión de 'Abdu'l-Bahá 1 AM).
// ─────────────────────────────────────────────────────────────────

export type HolyDayCelebrationRule =
  | { kind: "night_before" }
  | { kind: "exact_time"; hour: number; minute: number; label: string };

export type HolyDayDefinition = {
  id: string;                  // estable, usado para system_id
  name: string;
  workSuspended: boolean;
  rule: HolyDayCelebrationRule;
  description: string;         // texto inicial para el campo description
};

export const HOLY_DAYS: HolyDayDefinition[] = [
  {
    id: "naw_ruz",
    name: "Naw-Rúz",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Año Nuevo bahá'í. La comunidad se reúne para dar la bienvenida al nuevo año Badí'.",
  },
  {
    id: "ridvan_1",
    name: "Primer Día de Riḍván",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Conmemoración del primer día en que Bahá'u'lláh declaró Su Misión en el jardín de Riḍván, Bagdad, en 1863.",
  },
  {
    id: "ridvan_9",
    name: "Noveno Día de Riḍván",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Noveno día del Festival de Riḍván, cuando la familia de Bahá'u'lláh se unió a Él en el jardín.",
  },
  {
    id: "ridvan_12",
    name: "Duodécimo Día de Riḍván",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Último día del Festival de Riḍván, cuando Bahá'u'lláh partió del jardín hacia Constantinopla.",
  },
  {
    id: "declaration_bab",
    name: "Declaración del Báb",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Conmemoración de la declaración del Báb a Mullá Ḥusayn en Shiraz, la noche del 22 al 23 de mayo de 1844.",
  },
  {
    id: "ascension_bahaullah",
    name: "Ascensión de Bahá'u'lláh",
    workSuspended: true,
    rule: {
      kind: "exact_time",
      hour: 3,
      minute: 0,
      label: "3:00 de la madrugada",
    },
    description:
      "Conmemoración de la ascensión de Bahá'u'lláh en Bahjí, cerca de 'Akká, el 29 de mayo de 1892.",
  },
  {
    id: "martyrdom_bab",
    name: "Martirio del Báb",
    workSuspended: true,
    rule: { kind: "exact_time", hour: 12, minute: 0, label: "12:00 (mediodía)" },
    description:
      "Conmemoración del martirio del Báb en Tabriz, Persia, el mediodía del 9 de julio de 1850.",
  },
  {
    id: "birth_bab",
    name: "Nacimiento del Báb",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Primer día de los Cumpleaños Gemelos. Conmemoración del nacimiento del Báb en Shiraz en 1819.",
  },
  {
    id: "birth_bahaullah",
    name: "Nacimiento de Bahá'u'lláh",
    workSuspended: true,
    rule: { kind: "night_before" },
    description:
      "Segundo día de los Cumpleaños Gemelos. Conmemoración del nacimiento de Bahá'u'lláh en Teherán en 1817.",
  },
  {
    id: "covenant",
    name: "Día del Convenio",
    workSuspended: false,
    rule: { kind: "night_before" },
    description:
      "Conmemoración del Convenio establecido por Bahá'u'lláh, designando a 'Abdu'l-Bahá como Centro de Su Convenio.",
  },
  {
    id: "ascension_abdul_baha",
    name: "Ascensión de 'Abdu'l-Bahá",
    workSuspended: false,
    rule: {
      kind: "exact_time",
      hour: 1,
      minute: 0,
      label: "1:00 de la madrugada",
    },
    description:
      "Conmemoración de la ascensión de 'Abdu'l-Bahá en Haifa, el 28 de noviembre de 1921.",
  },
];

export function getHolyDayDefinition(
  id: string
): HolyDayDefinition | undefined {
  return HOLY_DAYS.find((h) => h.id === id);
}

// Fechas oficiales de los Días Sagrados por año Badí'.
// Fuente: https://www.bahai.org/es/action/devotional-life/calendar
// IMPORTANTE: Las fechas de los Cumpleaños Gemelos (birth_bab,
// birth_bahaullah) se calculan astronómicamente cada año. Verificar
// contra el sitio oficial al actualizar.
export type HolyDayYearDates = {
  bahaiYear: number;
  dates: Record<string, string>; // id → ISO YYYY-MM-DD (fecha oficial)
};

export const HOLY_DAY_DATES_BY_YEAR: HolyDayYearDates[] = [
  {
    bahaiYear: 183,
    dates: {
      naw_ruz: "2026-03-20",
      ridvan_1: "2026-04-20",
      ridvan_9: "2026-04-28",
      ridvan_12: "2026-05-01",
      declaration_bab: "2026-05-23",
      ascension_bahaullah: "2026-05-29",
      martyrdom_bab: "2026-07-09",
      birth_bab: "2026-11-10",        // VERIFICAR con bahai.org
      birth_bahaullah: "2026-11-11",  // VERIFICAR con bahai.org
      covenant: "2026-11-26",
      ascension_abdul_baha: "2026-11-28",
    },
  },
  {
    bahaiYear: 184,
    dates: {
      naw_ruz: "2027-03-21",
      ridvan_1: "2027-04-21",
      ridvan_9: "2027-04-29",
      ridvan_12: "2027-05-02",
      declaration_bab: "2027-05-23",
      ascension_bahaullah: "2027-05-29",
      martyrdom_bab: "2027-07-10",
      birth_bab: "2027-10-30",        // VERIFICAR con bahai.org
      birth_bahaullah: "2027-10-31",  // VERIFICAR con bahai.org
      covenant: "2027-11-26",
      ascension_abdul_baha: "2027-11-28",
    },
  },
];

export function getHolyDayDatesForYear(
  bahaiYear: number
): HolyDayYearDates | undefined {
  return HOLY_DAY_DATES_BY_YEAR.find((d) => d.bahaiYear === bahaiYear);
}

/**
 * Dada la fecha oficial y la regla, calcula la fecha y hora de
 * celebración (lo que se muestra en el calendario).
 */
export function computeHolyDayCelebration(
  officialDateIso: string,
  rule: HolyDayCelebrationRule
): { date: string; time: string } {
  if (rule.kind === "exact_time") {
    return { date: officialDateIso, time: rule.label };
  }
  return { date: celebrationDateFor(officialDateIso), time: "Al atardecer" };
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
