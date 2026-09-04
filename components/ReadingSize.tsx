"use client";

import { useEffect, useState } from "react";

// Control de tamaño de letra para las pantallas de LECTURA (oraciones,
// mensajes de la Casa Universal, Escritos Sagrados). Tres pasos; la
// preferencia es una sola para toda la app y se guarda por dispositivo.
//
// El índice 0 es el tamaño original de cada pantalla: cada consumidor
// pasa su base en px a readingStyle() y el paso solo la escala, así el
// SSR coincide con el primer render y no hay salto visible.

const STORAGE_KEY = "lectura-font-size";
/** Clave que usaba PrayerReader antes de unificar; se lee como fallback. */
const LEGACY_KEY = "oracion-font-size";

const SCALES = [1, 1.18, 1.38];
const LINE_HEIGHTS = ["1.7", "1.78", "1.85"];
const LABELS = ["Pequeño", "Mediano", "Grande"];

export const READING_SIZES = SCALES.length;

export function readingStyle(basePx: number, size: number) {
  const i = Math.min(Math.max(size, 0), SCALES.length - 1);
  return {
    fontSize: `${Math.round(basePx * SCALES[i] * 10) / 10}px`,
    lineHeight: LINE_HEIGHTS[i],
  };
}

export function useReadingSize() {
  const [size, setSize] = useState(0);

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_KEY);
      const n = stored === null ? NaN : parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= 0 && n < SCALES.length) setSize(n);
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }, []);

  function choose(n: number) {
    setSize(n);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(n));
    } catch {
      // Ídem: sin persistencia, el tamaño vale por esta pantalla.
    }
  }

  return [size, choose] as const;
}

export function ReadingSizeControl({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-end gap-2 ${className}`}>
      <span className="mr-1 text-[11px] font-medium text-muted">Tamaño</span>
      <div
        className="inline-flex overflow-hidden rounded-xl border border-black/[0.08]"
        role="group"
        aria-label="Tamaño de la letra"
      >
        {SCALES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={i === value}
            aria-label={LABELS[i]}
            title={LABELS[i]}
            className={`tap flex h-9 w-10 items-center justify-center border-l border-black/[0.08] font-display font-semibold first:border-l-0 ${
              i === value
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
  );
}
