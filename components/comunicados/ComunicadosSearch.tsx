"use client";

import { useMemo, useState, type ReactNode } from "react";
import { IconSearch } from "@/components/Icons";

export type SearchableItem = {
  id: string;
  /** Texto donde se busca: título, asunto, extracto y texto completo. */
  haystack: string;
  /** La tarjeta ya armada en el servidor. */
  card: ReactNode;
};

type Props = {
  items: SearchableItem[];
  /** Lo que se muestra si la lista está vacía sin buscar nada. */
  emptyText: string;
  /** Lo que va al pie de la lista (el link a los ocultos). */
  footer?: ReactNode;
};

/**
 * El buscador de Comunicados. Antes el cuadro era un dibujo: un <span> con
 * "Buscar comunicado…" y nada detrás.
 *
 * Filtra en el navegador, al escribir, sobre la lista que ya llegó: no hay
 * ida al servidor ni recarga. Las tarjetas que no coinciden se ESCONDEN
 * (`hidden`), no se desmontan, por dos razones: conservan su estado (la
 * opción elegida en una encuesta sin votar todavía), y una tarjeta
 * escondida no está en pantalla, así que el "visto" de la 048 no la marca
 * por error. Busca todas las palabras (en cualquier orden) sin mirar
 * acentos ni mayúsculas, porque en el celular se escribe sin tildes.
 */
export function ComunicadosSearch({ items, emptyText, footer }: Props) {
  const [query, setQuery] = useState("");

  const normalized = useMemo(
    () => items.map((it) => ({ id: it.id, text: normalize(it.haystack) })),
    [items]
  );
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches = new Set(
    words.length === 0
      ? items.map((it) => it.id)
      : normalized.filter((n) => words.every((w) => n.text.includes(w))).map((n) => n.id)
  );
  const searching = words.length > 0;

  return (
    <>
      <div className="shrink-0 px-4 pb-1.5 pt-0.5">
        <label
          className="flex items-center gap-2 rounded-xl px-3.5 py-2 ring-1 ring-transparent focus-within:bg-card focus-within:ring-gold/40"
          style={{ background: "#C4A23508" }}
        >
          <IconSearch size={15} className="shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              // En el celular, "Buscar" en el teclado lo cierra: el
              // filtrado ya está hecho.
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="Buscar comunicado…"
            aria-label="Buscar comunicado"
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-0.5 font-body text-[13.5px] text-dark outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Borrar la búsqueda"
              className="tap -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[13px] leading-none text-muted"
            >
              ×
            </button>
          )}
        </label>
      </div>
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        {items.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">{emptyText}</div>
        ) : (
          <>
            {searching && (
              <p className="mb-2.5 px-1 text-[11.5px] text-muted" role="status">
                {matches.size === 0
                  ? `Ningún comunicado dice “${query.trim()}”.`
                  : matches.size === 1
                    ? "1 comunicado"
                    : `${matches.size} comunicados`}
              </p>
            )}
            <div className="cb-stagger flex flex-col gap-4">
              {items.map((it) => (
                <div key={it.id} hidden={!matches.has(it.id)}>
                  {it.card}
                </div>
              ))}
            </div>
          </>
        )}
        {footer}
      </main>
    </>
  );
}

/** Minúsculas y sin tildes: "Reunión" y "reunion" son lo mismo. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
