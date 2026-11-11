"use client";

import {
  ReadingSizeControl,
  readingStyle,
  useReadingSize,
} from "@/components/ReadingSize";
import { MedallionRule, RosetteMark } from "@/components/prayers/PersianOrnaments";
import { PostureFigure } from "@/components/prayers/PostureFigure";
import { POSTURE_LABELS, type PrayerBlock } from "@/lib/obligatory-prayers";

type Props = {
  body: string;
  author: string | null;
  /** Solo en las oraciones obligatorias: el texto separado en la guía de
   *  posturas y las palabras de la oración (lib/obligatory-prayers.ts). */
  blocks?: PrayerBlock[];
};

/**
 * Renderiza el cuerpo de una oración con control de tamaño de fuente.
 * La preferencia es compartida con las demás pantallas de lectura
 * (mensajes, Escritos) — ver components/ReadingSize.tsx.
 */
export function PrayerReader({ body, author, blocks }: Props) {
  const [size, setSize] = useReadingSize();
  const hasGuide = blocks?.some((b) => b.kind === "guia") ?? false;

  return (
    <>
      <MedallionRule className="mb-3" />
      <ReadingSizeControl value={size} onChange={setSize} className="mb-4" />

      {blocks ? (
        <div className="flex flex-col gap-4">
          {hasGuide && <Legend />}
          {blocks.map((block, i) => (
            <Block key={i} block={block} size={size} />
          ))}
        </div>
      ) : (
        <p
          className="whitespace-pre-line font-body text-dark"
          style={readingStyle(15.5, size)}
        >
          {body}
        </p>
      )}

      <RosetteMark className="mt-6" />
      {author && (
        <p className="mt-2 text-center font-display text-[14px] italic text-muted">
          — {author}
        </p>
      )}
    </>
  );
}

/** Dice, antes de empezar, qué es cada cosa. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[4px] border border-terra/25 bg-terra/[0.07]" />
        Guía de posturas (no se recita)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-[3px] rounded-full bg-gold" />
        Palabras de la oración
      </span>
    </div>
  );
}

function Block({ block, size }: { block: PrayerBlock; size: number }) {
  if (block.kind === "texto") {
    return (
      <p
        className="border-l-[3px] border-gold/70 pl-3.5 font-body text-dark"
        style={readingStyle(15.5, size)}
      >
        {block.text}
      </p>
    );
  }

  if (block.kind === "nota") {
    return (
      <p
        className="rounded-xl bg-bg px-3.5 py-2.5 text-center font-body italic text-muted"
        style={readingStyle(12.5, size)}
      >
        {block.text}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-terra/15 bg-terra/[0.05] p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-terra">
        Postura
      </div>
      {block.postures.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-start gap-x-2 gap-y-2">
          {block.postures.map((posture, i) => (
            <div key={posture} className="flex items-start gap-2">
              {i > 0 && (
                <span aria-hidden className="mt-7 text-[15px] text-terra/40">
                  →
                </span>
              )}
              <figure className="flex w-[88px] flex-col items-center text-center text-terra">
                <PostureFigure posture={posture} width={68} />
                <figcaption className="mt-1 text-[10px] leading-tight text-terra/80">
                  {POSTURE_LABELS[posture]}
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      )}
      <p
        className="font-sans text-terra/90"
        style={readingStyle(12.5, size)}
      >
        {block.text}
      </p>
      {block.greatestName && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          * El Más Grande Nombre: «Alláh-u-Abhá».
        </p>
      )}
    </div>
  );
}
