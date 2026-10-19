"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ReadingSizeControl,
  readingStyle,
  useReadingSize,
} from "@/components/ReadingSize";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import { FolletoFigure, ItemIconSvg } from "@/components/ensenanza/FolletoFigures";
import type { FolletoBlock, FolletoChapter, FolletoPhoto } from "@/lib/la-fe";

/**
 * El folleto, un capítulo por pantalla. Lo usan la pantalla pública
 * `/la-fe` y el segmento La Fe del hub Enseñanza, con el MISMO contenido:
 * lo que practica el creyente es exactamente lo que lee el simpatizante.
 *
 * Cada capítulo abre con una foto de portada (media.bahai.org, reducida)
 * y una ilustración SVG animada como marca de agua; adentro, los bloques
 * (texto, listas con ícono, fotos, galería, línea de tiempo, citas) entran
 * con la clase `cb-chapter-in`, que se vuelve a disparar en cada capítulo
 * porque el árbol lleva `key={slug}`.
 *
 * El capítulo vive en el hash de la URL (`#principios`), así un link
 * compartido abre en el capítulo correcto y "atrás" del navegador vuelve
 * al anterior. Se pasa con las flechas del pie, los chips de arriba o un
 * swipe horizontal. `extra` es un último capítulo que arma quien lo monta
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
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

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

  // Swipe horizontal: más de 60 px, más horizontal que vertical, rápido.
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.t > 700) return;
    go(dx < 0 ? index + 1 : index - 1);
  }

  const isExtra = extra && index === chapters.length;
  const chapter = isExtra ? null : chapters[index];
  const total = slugs.length;

  return (
    <div ref={topRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Progreso: una barrita dorada que crece capítulo a capítulo. */}
      <div className="mb-2.5 h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gold-grad transition-[width] duration-500 ease-out"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

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

      <article key={slugs[index]} className="overflow-hidden rounded-2xl bg-card shadow-card-soft">
        {chapter ? (
          <>
            <Hero chapter={chapter} index={index} total={total} />
            <div className="p-5">
              <p
                className="cb-chapter-in font-body font-medium text-dark/85"
                style={{ ...readingStyle(15, size), animationDelay: "120ms" }}
              >
                {chapter.lead}
              </p>
              <ReadingSizeControl
                value={size}
                onChange={setSize}
                className="my-4 border-y border-black/[0.06] py-3"
              />
              <div className="space-y-5">
                {chapter.blocks.map((b, i) => (
                  <div
                    key={i}
                    className="cb-chapter-in"
                    style={{ animationDelay: `${Math.min(i, 6) * 90 + 180}ms` }}
                  >
                    <Block block={b} size={size} />
                  </div>
                ))}
              </div>
              {chapter.hero.caption && (
                <p className="mt-5 text-[11px] leading-relaxed text-muted">
                  Portada: {chapter.hero.caption}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="p-5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
              {index + 1} de {total}
            </div>
            <h1 className="cb-chapter-in font-display text-[22px] font-semibold leading-[1.2] text-dark">
              {extra!.title}
            </h1>
            <div className="cb-chapter-in mt-4" style={{ animationDelay: "120ms" }}>
              {extra!.content}
            </div>
          </div>
        )}
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
      <p className="mt-3 text-center text-[10.5px] text-muted">
        Deslizá para pasar de capítulo
      </p>
    </div>
  );

  function labelAt(i: number) {
    return i < chapters.length ? chapters[i].title : extra?.title ?? "";
  }
}

/** Portada del capítulo: la foto con degradé, el número, el título y la
 *  ilustración animada como marca de agua. */
function Hero({ chapter, index, total }: { chapter: FolletoChapter; index: number; total: number }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-pine">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={chapter.hero.src}
        src={chapter.hero.src}
        alt={chapter.hero.alt}
        className="cb-ken-burns absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: chapter.hero.position ?? "center" }}
        loading={index === 0 ? "eager" : "lazy"}
        decoding="async"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(31,58,44,0.15) 0%, rgba(31,58,44,0) 35%, rgba(20,22,30,0.55) 70%, rgba(20,22,30,0.88) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-[70%] w-[70%]"
        style={{ background: "radial-gradient(closest-side, rgba(20,22,30,0.55), rgba(20,22,30,0) 72%)" }}
      />
      <FolletoFigure
        name={chapter.figure}
        className="absolute -right-6 -top-6 h-[46%] w-auto opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="cb-fade-in mb-1 text-[11px] font-semibold uppercase tracking-[1.8px] text-gold-light">
          {index + 1} de {total}
        </div>
        <h1 className="cb-chapter-in font-display text-[24px] font-semibold leading-[1.15] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          {chapter.title}
        </h1>
      </div>
    </div>
  );
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

function Photo({ photo, className = "" }: { photo: FolletoPhoto; className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-xl bg-black/[0.04]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover"
          style={{ objectPosition: photo.position ?? "center" }}
        />
      </div>
      {photo.caption && (
        <figcaption className="mt-1.5 text-[11px] leading-snug text-muted">{photo.caption}</figcaption>
      )}
    </figure>
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
  if (block.kind === "figure") {
    return <FolletoFigure name={block.name} className="mx-auto h-44 w-44" />;
  }
  if (block.kind === "photo") {
    return <Photo photo={block.photo} />;
  }
  if (block.kind === "gallery") {
    return (
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-no-pull>
        {block.items.map((p) => (
          <figure key={p.src} className="w-[78%] shrink-0 snap-center">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} loading="lazy" decoding="async" className="block h-full w-full object-cover" />
              {p.icon && (
                <span className="absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-terra shadow-card-soft">
                  <ItemIconSvg name={p.icon} size={18} />
                </span>
              )}
            </div>
            {p.caption && (
              <figcaption className="mt-1.5 text-[11.5px] font-semibold leading-snug text-dark/80">{p.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }
  if (block.kind === "timeline") {
    return (
      <ol className="relative ml-2 border-l-2 border-gold/50 pl-5">
        {block.items.map((it, i) => (
          <li
            key={it.year}
            className="cb-chapter-in relative pb-4 last:pb-0"
            style={{ animationDelay: `${300 + i * 140}ms` }}
          >
            <span
              className="cb-pop absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-gold-dark bg-card"
              style={{ ["--cb-delay" as string]: `${300 + i * 140}ms` }}
            />
            <div className="text-[11px] font-bold tracking-[1px] text-gold-dark">{it.year}</div>
            <div className="font-semibold text-dark" style={readingStyle(14, size)}>{it.title}</div>
            <p className="mt-0.5 font-body text-dark/80" style={readingStyle(13, size)}>{it.text}</p>
          </li>
        ))}
      </ol>
    );
  }
  if (block.kind === "list") {
    return (
      <ul className="space-y-4">
        {block.items.map((it) => (
          <li key={it.title} className="flex gap-3">
            {it.icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/[0.07] text-terra">
                <ItemIconSvg name={it.icon} />
              </span>
            )}
            <div className={`min-w-0 flex-1 ${it.icon ? "" : "border-l-2 border-gold/60 pl-3"}`}>
              <div className="font-semibold text-dark" style={readingStyle(14, size)}>
                {it.title}
              </div>
              <p className="mt-0.5 font-body text-dark/85" style={readingStyle(13.5, size)}>
                {it.text}
              </p>
              {it.photo && <Photo photo={it.photo} className="mt-3 max-w-[320px]" />}
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <blockquote className="relative overflow-hidden rounded-xl bg-gold/[0.08] px-4 py-3.5">
      <span aria-hidden="true" className="absolute -right-1 -top-4 font-display text-[64px] leading-none text-gold/25">
        “
      </span>
      <p
        className="relative font-display italic leading-[1.5] text-dark"
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
