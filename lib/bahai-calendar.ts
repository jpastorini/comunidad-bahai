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
