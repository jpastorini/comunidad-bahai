"use server";

import { requireMember } from "@/lib/auth";
import { searchCorpus, type CorpusSearchResult } from "@/lib/corpus-search";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Tope de búsquedas por persona en 24 horas. Cada búsqueda son dos
 * llamadas a Haiku (unos centavos): alcanza de sobra para uso real y
 * frena un bucle o un uso indebido.
 *
 * No se exporta: un módulo "use server" solo puede exportar funciones
 * async (el build de Next falla, el type-check no lo ve).
 */
const MAX_SEARCHES_PER_DAY = 40;
const MAX_QUERY_LENGTH = 200;

export async function buscarAction(rawQuery: string): Promise<CorpusSearchResult> {
  const session = await requireMember("/buscar");
  const query = (rawQuery ?? "").replace(/\s+/g, " ").trim();
  if (query.length < 3) return { ok: false, error: "Escribí al menos tres letras." };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `La consulta es muy larga (máximo ${MAX_QUERY_LENGTH} caracteres).` };
  }

  const supabase = createSupabaseServer();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("corpus_searches")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", session.user.id)
    .gte("created_at", since);
  if (countError) {
    console.error("[buscar] corpus_searches:", countError);
    if (countError.code === "42P01") {
      return {
        ok: false,
        error: "El buscador todavía no está habilitado en la base (falta aplicar la migración 053).",
      };
    }
  } else if ((count ?? 0) >= MAX_SEARCHES_PER_DAY) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${MAX_SEARCHES_PER_DAY} búsquedas por día. Mañana podés seguir.`,
    };
  }

  const result = await searchCorpus(supabase, query);

  if (result.ok) {
    const { error } = await supabase.from("corpus_searches").insert({
      profile_id: session.user.id,
      query,
      terms: result.terms,
      results: result.hits.length,
    });
    if (error) console.warn("[buscar] no se registró la consulta:", error.message);
  }
  return result;
}
