"use client";

import {
  ReadingSizeControl,
  readingStyle,
  useReadingSize,
} from "@/components/ReadingSize";
import type { Cita } from "@/lib/citas";

// Lista de citas de un tema con control de tamaño de letra, compartido
// con las demás pantallas de lectura (ver components/ReadingSize.tsx).
export function QuotesReader({ quotes }: { quotes: Cita[] }) {
  const [size, setSize] = useReadingSize();

  return (
    <>
      <ReadingSizeControl value={size} onChange={setSize} className="mb-3" />
      <div className="space-y-2.5">
        {quotes.map((cita) => (
          <article
            key={cita.id}
            className="rounded-2xl bg-card p-4 shadow-card-soft"
          >
            <p className="font-body text-dark" style={readingStyle(14, size)}>
              {cita.text}
            </p>
            <div className="mt-2 font-body text-[11px] text-muted">
              — {cita.reference}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
