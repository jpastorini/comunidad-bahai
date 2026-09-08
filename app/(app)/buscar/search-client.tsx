"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { IconSearch } from "@/components/Icons";
import type { CorpusSearchResult, SearchHit } from "@/lib/corpus-search";
import { SharePrayerButton } from "../oraciones/share-button";
import { buscarAction } from "./actions";

const EXAMPLES = [
  "la consulta",
  "la educación de los niños",
  "la oración",
  "la unidad de la humanidad",
  "la vida después de la muerte",
  "el servicio a los demás",
  "la justicia",
  "la Fiesta de 19 Días",
];

const KIND_BADGE: Record<SearchHit["source_kind"], { label: string; className: string }> = {
  cita: { label: "Escritos", className: "bg-gold/15 text-gold-dark" },
  libro: { label: "Libro", className: "bg-terra/10 text-terra" },
  mensaje: { label: "Casa Universal de Justicia", className: "bg-[#2A3F8F]/10 text-[#2A3F8F]" },
  ruhi: { label: "Instituto Ruhí", className: "bg-[#6A8B5F]/12 text-[#4F6B46]" },
};

type State =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; result: CorpusSearchResult; query: string };

/**
 * La pantalla del buscador. Todo el trabajo pasa en el server action
 * (`buscarAction`): acá solo se toma la pregunta, se muestra la espera
 * y se dibujan los pasajes que volvieron.
 */
export function SearchClient({
  initialQuery,
  nav,
}: {
  initialQuery: string;
  /** Los segmentos de la Biblioteca, que van DEBAJO del cuadro de búsqueda. */
  nav?: ReactNode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const ranInitial = useRef(false);

  function run(q: string) {
    const clean = q.replace(/\s+/g, " ").trim();
    if (clean.length < 3 || pending) return;
    setQuery(clean);
    setState({ status: "loading", query: clean });
    startTransition(async () => {
      const result = await buscarAction(clean);
      setState({ status: "done", result, query: clean });
    });
  }

  // Llega con ?q= (por ejemplo desde un link compartido): busca de una.
  useEffect(() => {
    if (initialQuery && !ranInitial.current) {
      ranInitial.current = true;
      run(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  return (
    <>
      <form
        className="shrink-0 px-4 pb-1 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-card px-3.5 py-2 shadow-card-soft ring-1 ring-black/[0.06] focus-within:ring-gold/40">
          <IconSearch size={16} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿Qué dicen los Escritos sobre…?"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent py-1 font-body text-[14px] text-dark outline-none placeholder:text-muted/70"
          />
          <button
            type="submit"
            disabled={pending || query.trim().length < 3}
            className="tap shrink-0 rounded-xl bg-terra px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
      </form>

      {nav}

      <main className="scroll-area flex-1 px-4 pb-8 pt-1">
        {state.status === "idle" && (
          <Intro onPick={(q) => run(q)} />
        )}

        {state.status === "loading" && <Loading query={state.query} />}

        {state.status === "done" && !state.result.ok && (
          <div className="rounded-2xl bg-rose-50 p-4 text-[13px] leading-relaxed text-rose-800 ring-1 ring-rose-200">
            {state.result.error}
          </div>
        )}

        {state.status === "done" && state.result.ok && (
          <Results result={state.result} onPick={(q) => run(q)} />
        )}
      </main>
    </>
  );
}

function Intro({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="pt-2">
      <p className="px-1 font-body text-[13px] leading-relaxed text-dark/80">
        Escribí un tema o una pregunta y te sugerimos pasajes de los Escritos,
        de los mensajes de la Casa Universal de Justicia y de los libros del
        Instituto Ruhí donde se habla de eso. Los textos se muestran tal como
        están en la fuente.
      </p>
      <h2 className="mb-2 mt-5 px-1 text-[13px] font-semibold text-dark">
        Por ejemplo
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onPick(ex)}
            className="tap rounded-full bg-card px-3 py-1.5 text-[12px] font-medium text-dark shadow-card-soft hover:bg-bg"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function Loading({ query }: { query: string }) {
  return (
    <div className="pt-6 text-center">
      <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      <p className="font-body text-[13px] text-muted">
        Buscando <span className="font-semibold text-dark">“{query}”</span> en los
        Escritos, los mensajes y las citas…
      </p>
      <p className="mt-1 font-body text-[11px] text-muted/80">Suele tardar unos segundos.</p>
    </div>
  );
}

function Results({
  result,
  onPick,
}: {
  result: Extract<CorpusSearchResult, { ok: true }>;
  onPick: (q: string) => void;
}) {
  if (result.hits.length === 0) {
    return (
      <div className="pt-2">
        <div className="rounded-2xl bg-card p-4 text-[13px] leading-relaxed text-dark/80 shadow-card-soft">
          No encontramos pasajes que traten{" "}
          <span className="font-semibold">“{result.query}”</span>. Probá con
          otras palabras o con un tema más general.
        </div>
        <h2 className="mb-2 mt-5 px-1 text-[13px] font-semibold text-dark">Probá con</h2>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.slice(0, 5).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onPick(ex)}
              className="tap rounded-full bg-card px-3 py-1.5 text-[12px] font-medium text-dark shadow-card-soft"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {result.orientation && (
        <section className="rounded-2xl bg-card p-4 shadow-card-soft ring-1 ring-gold/15">
          <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-gold-dark/70">
            ✦ Orientación
          </div>
          <p className="font-body text-[13.5px] leading-relaxed text-dark">
            {result.orientation}
          </p>
          <p className="mt-2 font-body text-[10.5px] leading-snug text-muted">
            La redacta un asistente automático a partir de los pasajes de abajo y
            puede equivocarse. Lo que vale son los textos.
          </p>
        </section>
      )}

      <div className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[1px] text-muted">
        {result.hits.length} {result.hits.length === 1 ? "pasaje" : "pasajes"}
      </div>

      {result.hits.map((hit, i) => (
        <HitCard key={hit.id} hit={hit} index={i + 1} />
      ))}

      <p className="mt-3 px-1 font-body text-[10.5px] leading-relaxed text-muted">
        Los pasajes se muestran tal como están en la fuente. Se buscó en los
        libros con traducción autorizada, los mensajes de Riḍván de la Casa
        Universal de Justicia, los libros del Instituto Ruhí y la compilación
        de citas de la Lectura de hoy.
      </p>
    </div>
  );
}

function HitCard({ hit, index }: { hit: SearchHit; index: number }) {
  const badge = KIND_BADGE[hit.source_kind];
  const isQuote = hit.source_kind === "cita";
  return (
    <article className="rounded-2xl bg-card p-4 shadow-card-soft">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-[1px] shrink-0 text-[11px] font-bold text-muted/70">[{index}]</span>
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
          <div className="mt-1 truncate text-[11.5px] font-semibold text-dark/80">
            {hit.doc_title}
            {hit.author && hit.source_kind === "libro" && (
              <span className="font-normal text-muted"> · {hit.author}</span>
            )}
          </div>
        </div>
      </div>

      <p
        className={
          isQuote
            ? "font-display text-[16px] italic leading-[1.5] text-dark"
            : "font-body text-[13.5px] leading-relaxed text-dark"
        }
      >
        {isQuote ? `“${hit.body}”` : hit.body}
      </p>

      <div className="mt-2 font-body text-[11.5px] text-muted">— {hit.reference}</div>

      {hit.reason && (
        <p className="mt-2 rounded-xl bg-bg px-3 py-2 font-body text-[12px] italic leading-snug text-dark/75">
          {hit.reason}
        </p>
      )}

      <div className="mt-3 border-t border-black/[0.06] pt-3">
        <SharePrayerButton
          title={hit.doc_title}
          body={hit.body}
          reference={hit.reference}
          label="Compartir pasaje"
        />
      </div>
    </article>
  );
}
