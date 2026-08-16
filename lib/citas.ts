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

export function getCitasData(): CitasData {
  return data;
}

export function findTopic(topicId: string): CitaTopic | null {
  return data.topics.find((t) => t.id === topicId) ?? null;
}

/** Todas las citas en una lista plana, en el orden del corpus. */
let flatCache: Array<{ cita: Cita; topic: CitaTopic }> | null = null;
function flatQuotes() {
  if (!flatCache) {
    flatCache = data.topics.flatMap((topic) =>
      topic.quotes.map((cita) => ({ cita, topic }))
    );
  }
  return flatCache;
}

/** Día civil en TZ como número entero de días desde 1970-01-01. */
export function civilDayNumber(now: Date = new Date()): number {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Paso multiplicativo para recorrer el corpus. Al ser coprimo con el total,
 * la secuencia pasa por TODAS las citas antes de repetir ninguna (991 citas
 * ≈ 2 años y 8 meses), y días consecutivos caen en temas bien distintos.
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
  const all = flatQuotes();
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
