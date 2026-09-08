import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentBahaiYear } from "./bahai-calendar";
import { civilDateISO } from "./citas";
import { isSchemaMissing } from "./polls-shared";
import { treasuryYearForDate } from "./treasury-year";
import type {
  AssemblyMember,
  AssemblyOffice,
  AssemblyRecord,
  AssemblyTerm,
} from "./types";

/**
 * Datos de la Asamblea (052): la ficha legal y la composición por
 * ejercicio. Todo lo lee y escribe solo la Asamblea de la localidad;
 * la RLS lo garantiza, acá solo se consulta.
 */

export const ASSEMBLY_DOCS_BUCKET = "asamblea-docs";
export const MAX_STATUTES_BYTES = 15 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export { ASSEMBLY_SIZE } from "./types";

/**
 * El ejercicio en curso de la Asamblea: el mismo corte que la Tesorería
 * (Riḍván a Riḍván), porque la Asamblea se elige en Riḍván. Si la fecha
 * cae fuera de los años cargados, cae al año bahá'í del calendario.
 */
export function currentAssemblyYear(today: Date = new Date()): number {
  const iso = civilDateISO(today);
  return treasuryYearForDate(iso) ?? getCurrentBahaiYear(today) ?? 183;
}

export type AssemblyTermWithMembers = AssemblyTerm & { members: AssemblyMember[] };

export type AssemblyData = {
  /** false si la 052 no corrió todavía. */
  ready: boolean;
  record: AssemblyRecord | null;
  /** URL firmada del PDF de estatutos, si hay. */
  statutesUrl: string | null;
  /** Años BE con composición cargada, de más nuevo a más viejo. */
  years: number[];
  /** El ejercicio pedido, con sus miembros (null si no se cargó todavía). */
  term: AssemblyTermWithMembers | null;
  /** El ejercicio anterior más cercano con miembros, para pre-cargar. */
  previousTerm: AssemblyTermWithMembers | null;
};

async function getTermWithMembers(
  supabase: SupabaseClient,
  localityId: string,
  year: number
): Promise<AssemblyTermWithMembers | null> {
  const { data: term, error } = await supabase
    .from("assembly_terms")
    .select("*")
    .eq("locality_id", localityId)
    .eq("bahai_year", year)
    .maybeSingle();
  if (error || !term) return null;

  const { data: members } = await supabase
    .from("assembly_members")
    .select("*")
    .eq("term_id", term.id)
    .order("position", { ascending: true });

  return { ...(term as AssemblyTerm), members: (members ?? []) as AssemblyMember[] };
}

export async function getAssemblyData(
  supabase: SupabaseClient,
  localityId: string,
  year: number
): Promise<AssemblyData> {
  const empty: AssemblyData = {
    ready: true,
    record: null,
    statutesUrl: null,
    years: [],
    term: null,
    previousTerm: null,
  };

  const [{ data: record, error: recordError }, { data: termRows, error: termsError }] =
    await Promise.all([
      supabase.from("assembly_records").select("*").eq("locality_id", localityId).maybeSingle(),
      supabase
        .from("assembly_terms")
        .select("bahai_year")
        .eq("locality_id", localityId)
        .order("bahai_year", { ascending: false }),
    ]);

  if (recordError || termsError) {
    const code = recordError?.code ?? termsError?.code;
    if (isSchemaMissing(code)) return { ...empty, ready: false };
    console.error("[getAssemblyData]", recordError ?? termsError);
  }

  const years = (termRows ?? []).map((r) => Number((r as { bahai_year: number }).bahai_year));
  const term = await getTermWithMembers(supabase, localityId, year);
  const prevYear = years.find((y) => y < year);
  const previousTerm =
    prevYear !== undefined ? await getTermWithMembers(supabase, localityId, prevYear) : null;

  const rec = (record ?? null) as AssemblyRecord | null;
  let statutesUrl: string | null = null;
  if (rec?.statutes_path) {
    const { data } = await supabase.storage
      .from(ASSEMBLY_DOCS_BUCKET)
      .createSignedUrl(rec.statutes_path, SIGNED_URL_TTL_SECONDS);
    statutesUrl = data?.signedUrl ?? null;
  }

  return { ready: true, record: rec, statutesUrl, years, term, previousTerm };
}

/** Quién ocupa un cargo en un ejercicio, si alguien. */
export function officerOf(
  term: AssemblyTermWithMembers | null,
  office: AssemblyOffice
): AssemblyMember | null {
  return term?.members.find((m) => m.office === office) ?? null;
}
