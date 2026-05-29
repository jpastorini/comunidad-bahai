"use client";

import { useEffect, useState } from "react";

type Props = {
  body: string;
  author: string | null;
};

const STORAGE_KEY = "oracion-font-size";

/** Tres tamaños de lectura. El índice 0 (más chico) es el tamaño original. */
const SIZES: { fontSize: string; lineHeight: string }[] = [
  { fontSize: "15.5px", lineHeight: "1.75" },
  { fontSize: "18px", lineHeight: "1.8" },
  { fontSize: "21px", lineHeight: "1.85" },
];

const LABELS = ["Pequeño", "Mediano", "Grande"];

/**
 * Renderiza el cuerpo de una oración con control de tamaño de fuente
 * (3 pasos). La preferencia se guarda en localStorage por dispositivo,
 * así que cada usuario conserva el último tamaño que eligió.
 */
export function PrayerReader({ body, author }: Props) {
  // Arranca en el más chico (= tamaño original) para que el SSR coincida y
  // no haya salto visible; al montar leemos la preferencia guardada.
  const [size, setSize] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const n = stored === null ? NaN : parseInt(stored, 10);
    if (!Number.isNaN(n) && n >= 0 && n < SIZES.length) setSize(n);
  }, []);

  function choose(n: number) {
    setSize(n);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(n));
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }

  const current = SIZES[size];

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="mr-1 text-[11px] font-medium text-muted">Tamaño</span>
        <div
          className="inline-flex overflow-hidden rounded-xl border border-black/[0.08]"
          role="group"
          aria-label="Tamaño de la letra"
        >
          {SIZES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={i === size}
              aria-label={LABELS[i]}
              title={LABELS[i]}
              className={`tap flex h-9 w-10 items-center justify-center border-l border-black/[0.08] font-display font-semibold first:border-l-0 ${
                i === size
                  ? "bg-terra text-white"
                  : "bg-card text-muted hover:bg-bg"
              }`}
              style={{ fontSize: `${12 + i * 3}px` }}
            >
              A
            </button>
          ))}
        </div>
      </div>

      <p
        className="whitespace-pre-line font-body text-dark"
        style={{ fontSize: current.fontSize, lineHeight: current.lineHeight }}
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
