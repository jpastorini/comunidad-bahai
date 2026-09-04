"use client";

import {
  ReadingSizeControl,
  readingStyle,
  useReadingSize,
} from "@/components/ReadingSize";

type Props = {
  body: string;
  author: string | null;
};

/**
 * Renderiza el cuerpo de una oración con control de tamaño de fuente.
 * La preferencia es compartida con las demás pantallas de lectura
 * (mensajes, Escritos) — ver components/ReadingSize.tsx.
 */
export function PrayerReader({ body, author }: Props) {
  const [size, setSize] = useReadingSize();

  return (
    <>
      <ReadingSizeControl value={size} onChange={setSize} className="mb-4" />

      <p
        className="whitespace-pre-line font-body text-dark"
        style={readingStyle(15.5, size)}
      >
        {body}
      </p>
      {author && (
        <p className="mt-5 text-right font-display text-[14px] italic text-muted">
          — {author}
        </p>
      )}
    </>
  );
}
