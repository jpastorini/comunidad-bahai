import "server-only";
import citasJson from "../public/citas.json";

export type Cita = {
  id: string;
  text: string;
  reference: string;
  author: string;
};

export type CitaTopic = {
  id: string;
  name: string;
  quotes: Cita[];
};

export type CitasData = {
  source: string;
  sourceUrl: string;
  generatedAt: string;
  topicCount: number;
  quoteCount: number;
  topics: CitaTopic[];
};

/**
 * Corpus de citas de los Escritos Sagrados, generado desde la compilación
 * "La Fuente de Todo Bien" por scripts/build-citas.mjs.
 *
 * Se importa (bundled) para render server-side. El módulo es server-only:
 * son ~360 KB y no tienen por qué viajar al navegador — los componentes
 * cliente reciben la cita ya elegida como prop.
 */
const data = citasJson as unknown as CitasData;

/** Zona horaria civil de la comunidad. La cita cambia a la medianoche de
 *  esta zona, para que todos vean la misma el mismo día. */
const TZ = process.env.APP_TIMEZONE || "America/Montevideo";

/** Expuesta para que el cliente compare el día con el mismo huso que el
 *  servidor (ver components/DayChangeRefresh.tsx). */
export function getAppTimeZone(): string {
  return TZ;
}

export function getCitasData(): CitasData {
  return data;
}

export function findTopic(topicId: string): CitaTopic | null {
  return data.topics.find((t) => t.id === topicId) ?? null;
}

/** Texto normalizado, para reconocer la misma cita escrita en dos temas. */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pool del sorteo diario: una entrada por TEXTO único.
 *
 * La compilación repite 30 citas en más de un tema (la misma de
 * Bahá'u'lláh aparece bajo "Justicia" y bajo "Acciones Puras", por
 * ejemplo). Para navegar por tema eso está bien —la cita pertenece a los
 * dos—, pero en el sorteo contarían como dos citas distintas y el mismo
 * texto podría repetirse dentro de un ciclo. Nos quedamos con la primera
 * aparición.
 */
let dailyPoolCache: Array<{ cita: Cita; topic: CitaTopic }> | null = null;
export function getDailyPool(): Array<{ cita: Cita; topic: CitaTopic }> {
  if (!dailyPoolCache) {
    const seen = new Set<string>();
    const pool: Array<{ cita: Cita; topic: CitaTopic }> = [];
    for (const topic of data.topics) {
      for (const cita of topic.quotes) {
        const key = normalizeText(cita.text);
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push({ cita, topic });
      }
    }
    dailyPoolCache = pool;
  }
  return dailyPoolCache;
}

/** Fecha civil en TZ como "YYYY-MM-DD". */
export function civilDateISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Día civil en TZ como número entero de días desde 1970-01-01. */
export function civilDayNumber(now: Date = new Date()): number {
  const [y, m, d] = civilDateISO(now).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Paso multiplicativo para recorrer el pool. Al ser coprimo con el total,
 * la secuencia pasa por TODAS las citas antes de repetir ninguna (961
 * textos únicos ≈ 2 años y 7 meses), y días consecutivos caen en temas
 * bien distintos. Ver scripts/check-citas.mjs, que verifica que no haya
 * repeticiones dentro de ninguna ventana de 7 días.
 */
function step(total: number): number {
  let s = 389; // primo, elegido para que el salto no sea previsible
  while (s > 1 && gcd(s, total) !== 1) s--;
  return Math.max(1, s);
}

/**
 * La cita del día. Determinística a partir de la fecha civil: no hay tabla
 * ni estado, y toda la comunidad ve la misma cita el mismo día.
 */
export function getCitaDelDia(now: Date = new Date()): {
  cita: Cita;
  topic: CitaTopic;
} {
  const all = getDailyPool();
  const index = (civilDayNumber(now) * step(all.length)) % all.length;
  return all[index];
}

/** Recorte para previews (tarjeta de inicio, cuerpo de la notificación). */
export function excerpt(text: string, max = 180): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
