import oracionesJson from "../public/oraciones.json";

export type Prayer = {
  id: string;
  title: string;
  author: string | null;
  /** Subcategoría dentro de la categoría (p.ej. "Bebés" dentro de "Curación"). */
  section?: string;
  body: string;
};

export type PrayerCategory = {
  id: string;
  name: string;
  prayers: Prayer[];
};

export type PrayerGroup = {
  id: string;
  name: string;
  categories: PrayerCategory[];
};

export type OracionesData = {
  source: string;
  generatedAt: string;
  groups: PrayerGroup[];
};

/**
 * Datos de oraciones bahá'ís, generados desde el PDF oficial por
 * scripts/build-oraciones.mjs y guardados en public/oraciones.json.
 * Se importa (bundled) para render server-side; el archivo también queda
 * disponible en /oraciones.json para cache de la PWA.
 */
const data = oracionesJson as unknown as OracionesData;

export function getOraciones(): OracionesData {
  return data;
}

/** Cantidad de palabras de un texto (separadas por espacios en blanco).
 *  Se usa para mostrar la extensión de cada oración en el índice. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function findCategory(
  categoryId: string
): { group: PrayerGroup; category: PrayerCategory } | null {
  for (const group of data.groups) {
    const category = group.categories.find((c) => c.id === categoryId);
    if (category) return { group, category };
  }
  return null;
}

export function findPrayer(
  categoryId: string,
  prayerId: string
): { group: PrayerGroup; category: PrayerCategory; prayer: Prayer } | null {
  const found = findCategory(categoryId);
  if (!found) return null;
  const prayer = found.category.prayers.find((p) => p.id === prayerId);
  if (!prayer) return null;
  return { ...found, prayer };
}
