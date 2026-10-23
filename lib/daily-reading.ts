import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  civilDateISO,
  getCitaDelDia,
  type Cita,
  type CitaTopic,
} from "./citas";
import {
  createSupabaseAnonNoCookies,
  isSupabaseConfigured,
} from "./supabase/server";

/**
 * La Lectura de hoy tal como la ve la comunidad: la cita calculada por
 * fecha (lib/citas.ts) o, si el admin nacional cargó una a mano para ese
 * día, esa (migración 081). Todo lo que muestra o avisa la Lectura de hoy
 * pasa por acá, así la pantalla y el push nunca dicen cosas distintas.
 */
export type DailyReading = {
  cita: Cita;
  /** El tema del corpus; null en una cita cargada a mano, que no es de
   *  ningún tema (y por eso no hay "Más sobre…"). */
  topic: CitaTopic | null;
  /** Lo que va junto a "Lectura de hoy": el título de la cita manual o el
   *  nombre del tema. */
  label: string;
  manual: boolean;
};

export type DailyReadingOverride = {
  reading_date: string;
  text: string;
  reference: string;
  title: string | null;
};

export const DAILY_READING_TAG = "daily-reading";

/** "YYYY-MM-DD" más n días, sin pasar por husos. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * La fila de un día, o null. Va por el cliente anónimo dentro de
 * unstable_cache (la policy de lectura es `using (true)`, 081) para no
 * sumar una ida a Supabase en cada Inicio; guardar o borrar tira el caché
 * con DAILY_READING_TAG. Un error —la 081 sin aplicar, por ejemplo— cae a
 * null: la Lectura de hoy sigue saliendo del corpus.
 */
export const getReadingOverride = cache(
  async (date: string): Promise<DailyReadingOverride | null> => {
    if (!isSupabaseConfigured()) return null;
    return unstable_cache(
      async () => {
        const supabase = createSupabaseAnonNoCookies();
        const { data, error } = await supabase
          .from("daily_reading_overrides")
          .select("reading_date, text, reference, title")
          .eq("reading_date", date)
          .maybeSingle();
        if (error) {
          console.warn("[daily-reading] no se pudo leer la cita manual:", error.message);
          return null;
        }
        return (data as DailyReadingOverride | null) ?? null;
      },
      ["daily-reading", date],
      { tags: [DAILY_READING_TAG], revalidate: 600 }
    )();
  }
);

export async function getLecturaDelDia(
  now: Date = new Date()
): Promise<DailyReading> {
  const date = civilDateISO(now);
  const override = await getReadingOverride(date);
  if (override) {
    return {
      cita: {
        id: `manual-${date}`,
        text: override.text,
        reference: override.reference,
        author: "",
      },
      topic: null,
      label: override.title?.trim() || "Escritos Sagrados",
      manual: true,
    };
  }
  const { cita, topic } = getCitaDelDia(now);
  return { cita, topic, label: topic.name, manual: false };
}
