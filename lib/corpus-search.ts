import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Buscador de pasajes (migración 053): la base busca, Haiku elige y
 * explica.
 *
 * El corpus (~1,8 M de palabras) no entra en ninguna llamada, así que el
 * modelo nunca lee todo. Hace dos cosas chicas:
 *   1. expandir la pregunta en términos de búsqueda con sinónimos, para
 *      que el full-text search de Postgres encuentre "deliberar" cuando
 *      preguntaron por "la consulta";
 *   2. de los ~60 candidatos que devuelve `search_corpus()`, elegir los
 *      8–10 que de verdad tratan el tema, decir por qué cada uno, y
 *      escribir una orientación de dos o tres frases.
 *
 * ⚠️ El texto que se muestra sale SIEMPRE de `corpus_chunks`, por número
 * de candidato: el modelo no transcribe ni un pasaje. Es la garantía de
 * que no aparezca una cita inventada o retocada, que en este corpus es
 * el error caro. La orientación sí la redacta el modelo y la pantalla lo
 * dice.
 *
 * Solo se usa desde server actions (necesita ANTHROPIC_API_KEY).
 */

const MODEL = "claude-haiku-4-5";
const CANDIDATES = 60;
const MAX_PICKS = 10;

export const CORPUS_KIND_LABELS = {
  cita: "Cita",
  libro: "Libro",
  ruhi: "Instituto Ruhí",
  mensaje: "Casa Universal de Justicia",
} as const;
export type CorpusKind = keyof typeof CORPUS_KIND_LABELS;

export type CorpusChunk = {
  id: string;
  source_kind: CorpusKind;
  doc_key: string;
  doc_title: string;
  author: string | null;
  reference: string;
  position: number;
  body: string;
  word_count: number;
  rank: number;
};

export type SearchHit = CorpusChunk & {
  /** Por qué este pasaje viene al caso, en una frase (la escribe el modelo). */
  reason: string;
};

export type CorpusSearchResult =
  | {
      ok: true;
      query: string;
      /** Términos con que se buscó en la base (para el registro). */
      terms: string[];
      /** Cuántos candidatos devolvió la base antes de elegir. */
      candidates: number;
      /** Dos o tres frases del modelo sobre cómo tratan el tema los pasajes; "" si no hubo. */
      orientation: string;
      hits: SearchHit[];
    }
  | { ok: false; error: string };

// ─── Paso 1: la pregunta → términos de búsqueda ───────────────────────

const TERMS_TOOL: Anthropic.Tool = {
  name: "proponer_terminos",
  description: "Propone los términos con que buscar en el corpus.",
  input_schema: {
    type: "object",
    properties: {
      terms: {
        type: "array",
        description:
          "Entre 6 y 14 términos de búsqueda en español: palabras sueltas o frases de dos palabras, en su forma base.",
        items: { type: "string" },
      },
    },
    required: ["terms"],
  },
};

const TERMS_SYSTEM = `Recibís una pregunta o un tema, en español, sobre los Escritos bahá'ís, los mensajes de la Casa Universal de Justicia o los libros del Instituto Ruhí. Tu única tarea es proponer términos para una búsqueda de texto completo en ese corpus.

Pautas:
- Incluí las palabras clave de la pregunta en su forma base (sustantivo singular, verbo en infinitivo).
- Agregá sinónimos y conceptos vecinos con el vocabulario que usan esos textos (ej.: para "consulta" → "consultar", "deliberar", "deliberación", "unanimidad", "opiniones", "asamblea"). Para "muerte" → "morir", "vida después", "alma", "mundo venidero", "tránsito".
- Sacá las palabras vacías ("qué", "dicen", "sobre", "los") y no repitas.
- Palabras sueltas o frases de dos palabras, nunca oraciones. Entre 6 y 14.
Devolvé el resultado llamando a la herramienta proponer_terminos.`;

async function expandTerms(client: Anthropic, query: string): Promise<string[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: TERMS_SYSTEM,
    tools: [TERMS_TOOL],
    tool_choice: { type: "tool", name: "proponer_terminos" },
    messages: [{ role: "user", content: query }],
  });
  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "proponer_terminos"
  );
  const raw = (toolUse?.input as { terms?: unknown } | undefined)?.terms;
  const terms = Array.isArray(raw)
    ? raw
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase().replace(/["'«»“”]/g, ""))
        .filter((t) => t.length >= 3 && t.split(/\s+/).length <= 3)
    : [];
  return [...new Set(terms)].slice(0, 14);
}

/** Palabras "de contenido" de la propia pregunta, por si el modelo falla. */
function fallbackTerms(query: string): string[] {
  const STOP = new Set([
    "que", "qué", "dicen", "dice", "sobre", "los", "las", "el", "la", "de", "del", "en",
    "y", "o", "un", "una", "es", "son", "como", "cómo", "para", "por", "con", "se", "al",
    "lo", "hay", "escritos", "baha'i", "bahai", "bahá'í", "acerca", "tema", "cual", "cuál",
  ]);
  return query
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"«»]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Sintaxis de websearch_to_tsquery: frases entre comillas, unidas con OR. */
function toWebsearchQuery(terms: string[]): string {
  return terms.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
}

// ─── Paso 2: de los candidatos, los que vienen al caso ────────────────

const PICK_TOOL: Anthropic.Tool = {
  name: "elegir_pasajes",
  description: "Elige los pasajes que tratan el tema consultado y explica cada elección.",
  input_schema: {
    type: "object",
    properties: {
      orientacion: {
        type: "string",
        description:
          "Dos o tres frases, neutras, que digan cómo tratan el tema los pasajes elegidos, remitiendo a ellos por su número entre corchetes, ej. [3]. Vacía ('') si no se eligió ninguno.",
      },
      pasajes: {
        type: "array",
        description:
          "Los pasajes elegidos, del más al menos pertinente. Como máximo diez. Vacía si ninguno trata el tema.",
        items: {
          type: "object",
          properties: {
            n: {
              type: "integer",
              description: "El número del candidato, tal como aparece entre corchetes en la lista.",
            },
            motivo: {
              type: "string",
              description:
                "Una frase de hasta 25 palabras: qué dice este pasaje sobre el tema. Sin agregar nada que el pasaje no diga.",
            },
          },
          required: ["n", "motivo"],
        },
      },
    },
    required: ["orientacion", "pasajes"],
  },
};

const PICK_SYSTEM = `Ayudás a una comunidad bahá'í a encontrar pasajes en sus textos. Recibís una consulta y una lista numerada de candidatos que devolvió una búsqueda de texto. Cada candidato es un pasaje tomado tal cual de los Escritos, de un mensaje de la Casa Universal de Justicia, de un libro del Instituto Ruhí o de una compilación de citas.

Tu tarea:
- Elegí SOLO los candidatos que de verdad tratan el tema de la consulta. Que compartan una palabra no alcanza; que lo traten con otras palabras sí cuenta.
- Ordenalos del más al menos pertinente. Como máximo diez. Si un pasaje repite casi lo mismo que otro ya elegido, quedate con uno.
- Preferí, a igual pertinencia, el pasaje que se entiende solo y el que es cita directa de los Escritos.
- Para cada uno, un motivo de una frase: qué dice ese pasaje sobre el tema. No agregues interpretación ni nada que el pasaje no diga.
- La orientación: dos o tres frases neutras que digan cómo tratan el tema los pasajes elegidos, remitiendo a ellos con su número entre corchetes, uno o dos por frase (no listas de números). No respondas desde tu propio conocimiento, no expliques doctrina, no agregues fuentes que no estén en la lista. Si no elegiste ninguno, dejala vacía.
- Si ningún candidato trata el tema, devolvé la lista vacía. Es mejor no sugerir nada que sugerir algo que no corresponde.
Devolvé el resultado llamando a la herramienta elegir_pasajes.`;

function sourceLabel(c: CorpusChunk): string {
  switch (c.source_kind) {
    case "cita":
      return `Cita · ${c.reference}`;
    case "mensaje":
      return `Casa Universal de Justicia · ${c.doc_title}`;
    case "ruhi":
      return `Instituto Ruhí · ${c.doc_title}`;
    default:
      return c.author ? `${c.author} · ${c.doc_title}` : c.doc_title;
  }
}

type Pick = { n: number; motivo: string };

async function pickPassages(
  client: Anthropic,
  query: string,
  candidates: CorpusChunk[]
): Promise<{ orientation: string; picks: Pick[] }> {
  const list = candidates
    .map((c, i) => `[${i + 1}] (${sourceLabel(c)})\n${c.body}`)
    .join("\n\n");
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: PICK_SYSTEM,
    tools: [PICK_TOOL],
    tool_choice: { type: "tool", name: "elegir_pasajes" },
    messages: [
      {
        role: "user",
        content: `Consulta: ${query}\n\nCandidatos:\n\n${list}`,
      },
    ],
  });
  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "elegir_pasajes"
  );
  const input = (toolUse?.input ?? {}) as { orientacion?: unknown; pasajes?: unknown };
  const orientation = typeof input.orientacion === "string" ? input.orientacion.trim() : "";
  const seen = new Set<number>();
  const picks: Pick[] = [];
  for (const p of Array.isArray(input.pasajes) ? input.pasajes : []) {
    if (typeof p !== "object" || p === null) continue;
    const { n, motivo } = p as { n?: unknown; motivo?: unknown };
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > candidates.length) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    picks.push({ n, motivo: typeof motivo === "string" ? motivo.trim() : "" });
    if (picks.length >= MAX_PICKS) break;
  }
  return { orientation, picks };
}

/**
 * La orientación remite a los candidatos por su número ([7]); en pantalla
 * los pasajes van en el orden elegido, así que se renumeran ([2]) y se
 * borra la marca de un candidato que no quedó.
 */
function renumber(orientation: string, picks: Pick[]): string {
  const pos = new Map(picks.map((p, i) => [p.n, i + 1]));
  return orientation
    .replace(/\[(\d+)\]/g, (_, d) => {
      const k = pos.get(Number(d));
      return k ? `[${k}]` : "";
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

// ─── La búsqueda entera ───────────────────────────────────────────────

export async function searchCorpus(
  supabase: SupabaseClient,
  rawQuery: string
): Promise<CorpusSearchResult> {
  const query = rawQuery.replace(/\s+/g, " ").trim();
  if (query.length < 3) return { ok: false, error: "Escribí al menos tres letras." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Falta configurar la clave de la API de Claude en el servidor." };
  }
  const client = new Anthropic();

  try {
    let terms: string[] = [];
    try {
      terms = await expandTerms(client, query);
    } catch (err) {
      console.warn("[buscar] expandTerms falló, se usa la pregunta tal cual:", err);
    }
    if (terms.length === 0) terms = fallbackTerms(query);
    if (terms.length === 0) return { ok: false, error: "No encontré palabras para buscar en esa pregunta." };

    const { data, error } = await supabase.rpc("search_corpus", {
      p_query: toWebsearchQuery(terms),
      p_limit: CANDIDATES,
    });
    if (error) {
      console.error("[buscar] search_corpus:", error);
      const schema = ["42883", "42P01", "PGRST202"].includes(error.code ?? "");
      return {
        ok: false,
        error: schema
          ? "El buscador todavía no está habilitado en la base (falta aplicar la migración 053)."
          : "No se pudo buscar en la base. Probá de nuevo en un momento.",
      };
    }
    const candidates = (data ?? []) as CorpusChunk[];
    if (candidates.length === 0) {
      return { ok: true, query, terms, candidates: 0, orientation: "", hits: [] };
    }

    const { orientation, picks } = await pickPassages(client, query, candidates);
    const hits: SearchHit[] = picks.map((p) => ({
      ...candidates[p.n - 1],
      reason: p.motivo,
    }));
    return {
      ok: true,
      query,
      terms,
      candidates: candidates.length,
      orientation: hits.length ? renumber(orientation, picks) : "",
      hits,
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "La clave de la API de Claude es inválida o expiró. Avisá al equipo técnico." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "El buscador está saturado en este momento. Esperá unos segundos y reintentá." };
    }
    console.error("[buscar]", err);
    return { ok: false, error: "No se pudo completar la búsqueda. Probá de nuevo." };
  }
}
