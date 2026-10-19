"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ReadingSizeControl,
  readingStyle,
  useReadingSize,
} from "@/components/ReadingSize";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import type { FolletoBlock, FolletoChapter } from "@/lib/la-fe";

/**
 * El folleto, un capítulo por pantalla. Lo usan la pantalla pública
 * `/la-fe` y el segmento La Fe del hub Enseñanza, con el MISMO contenido:
 * lo que practica el creyente es exactamente lo que lee el simpatizante.
 *
 * El capítulo vive en el hash de la URL (`#principios`), así un link
 * compartido abre en el capítulo correcto y "atrás" del navegador vuelve
 * al anterior. `extra` es un último capítulo que arma quien lo monta
 * (links y el formulario de contacto): el reader solo le da el lugar.
 */
export function FolletoReader({
  chapters,
  extra,
}: {
  chapters: FolletoChapter[];
  extra?: { short: string; title: string; content: ReactNode };
}) {
  const slugs = [...chapters.map((c) => c.slug), ...(extra ? ["contacto"] : [])];
  const [index, setIndex] = useState(0);
  const [size, setSize] = useReadingSize();
  const topRef = useRef<HTMLDivElement>(null);

  // Hash → capítulo al montar y con atrás/adelante del navegador.
  useEffect(() => {
    const apply = () => {
      const slug = window.location.hash.replace(/^#/, "");
      const i = slugs.indexOf(slug);
      setIndex(i >= 0 ? i : 0);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join("|")]);

  function go(i: number) {
    const next = Math.max(0, Math.min(slugs.length - 1, i));
    if (next === index) return;
    // pushState y no location.hash: el hash dispararía un scroll al
    // ancla, que no existe, y en algunos navegadores salta igual.
    window.history.pushState(null, "", `#${slugs[next]}`);
    setIndex(next);
    // El contenedor que scrollea cambia según dónde está montado (la app
    // usa .scroll-area; la pantalla pública, el documento).
    const scroller = topRef.current?.closest(".scroll-area");
    if (scroller) scroller.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }

  const isExtra = extra && index === chapters.length;
  const chapter = isExtra ? null : chapters[index];
  const total = slugs.length;

  return (
    <div ref={topRef}>
      {/* Índice: chips desplazables, el actual en terra. */}
      <nav
        aria-label="Capítulos"
        className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-no-pull
      >
        {chapters.map((c, i) => (
          <ChapterChip key={c.slug} active={i === index} onClick={() => go(i)}>
            {c.short}
          </ChapterChip>
        ))}
        {extra && (
          <ChapterChip active={index === chapters.length} onClick={() => go(chapters.length)}>
            {extra.short}
          </ChapterChip>
        )}
      </nav>

      <article className="rounded-2xl bg-card p-5 shadow-card-soft">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
          {index + 1} de {total}
        </div>
        <h1 className="font-display text-[22px] font-semibold leading-[1.2] text-dark">
          {isExtra ? extra!.title : chapter!.title}
        </h1>

        {chapter && (
          <>
            <p
              className="mt-3 font-body font-medium text-dark/85"
              style={readingStyle(15, size)}
            >
              {chapter.lead}
            </p>
            <ReadingSizeControl
              value={size}
              onChange={setSize}
              className="my-4 border-y border-black/[0.06] py-3"
            />
            <div className="space-y-4">
              {chapter.blocks.map((b, i) => (
                <Block key={i} block={b} size={size} />
              ))}
            </div>
          </>
        )}

        {isExtra && <div className="mt-4">{extra!.content}</div>}
      </article>

      {/* Anterior / siguiente al pie, con el nombre del destino. */}
      <div className="mt-3 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="tap flex flex-1 items-center gap-1.5 rounded-2xl bg-card px-3 py-3 text-left shadow-card disabled:opacity-40"
        >
          <IconChevronLeft size={16} className="shrink-0 text-terra" />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-muted">Anterior</span>
            <span className="block truncate text-[12.5px] font-semibold text-dark">
              {index > 0 ? labelAt(index - 1) : "—"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index >= total - 1}
          className="tap flex flex-1 items-center justify-end gap-1.5 rounded-2xl bg-terra px-3 py-3 text-right text-white shadow-card disabled:opacity-40"
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-white/70">Siguiente</span>
            <span className="block truncate text-[12.5px] font-semibold">
              {index < total - 1 ? labelAt(index + 1) : "—"}
            </span>
          </span>
          <IconChevronRight size={16} className="shrink-0" />
        </button>
      </div>
    </div>
  );

  function labelAt(i: number) {
    return i < chapters.length ? chapters[i].title : extra?.title ?? "";
  }
}

function ChapterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      className={`tap shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        active ? "bg-terra text-white" : "bg-card text-muted shadow-card-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Block({ block, size }: { block: FolletoBlock; size: number }) {
  if (block.kind === "p") {
    return (
      <p className="font-body text-dark" style={readingStyle(14, size)}>
        {block.text}
      </p>
    );
  }
  if (block.kind === "list") {
    return (
      <ul className="space-y-3">
        {block.items.map((it) => (
          <li key={it.title} className="border-l-2 border-gold/60 pl-3">
            <div className="font-semibold text-dark" style={readingStyle(14, size)}>
              {it.title}
            </div>
            <p className="mt-0.5 font-body text-dark/85" style={readingStyle(13.5, size)}>
              {it.text}
            </p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <blockquote className="rounded-xl bg-gold/[0.08] px-4 py-3.5">
      <p
        className="font-display italic leading-[1.5] text-dark"
        style={readingStyle(15, size)}
      >
        «{block.cita.text}»
      </p>
      <footer className="mt-2 text-[11.5px] font-semibold tracking-[0.2px] text-gold-dark">
        {block.cita.reference}
      </footer>
    </blockquote>
  );
}
