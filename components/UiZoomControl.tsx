"use client";

import { useState } from "react";
import { UI_ZOOM_COOKIE, UI_ZOOM_LEVELS } from "@/lib/ui-zoom";

/**
 * Selector del tamaño de letra global (ver lib/ui-zoom.ts). Tres pasos;
 * al tocar uno la app entera cambia al instante (variable CSS en <html>)
 * y la cookie queda para la próxima carga. El "Aa" de cada botón se
 * dibuja al tamaño que tendría, así la persona compara antes de elegir.
 */
export function UiZoomControl({ initial }: { initial: number }) {
  const [zoom, setZoom] = useState(initial);

  function choose(z: number) {
    setZoom(z);
    document.documentElement.style.setProperty("--ui-zoom", String(z));
    document.cookie = `${UI_ZOOM_COOKIE}=${z}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-card-soft">
      <div className="text-[13.5px] font-semibold text-dark">Tamaño de letra</div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
        Agranda toda la app: textos, botones e íconos. Se guarda en este
        dispositivo.
      </p>
      <div
        className="mt-3 grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Tamaño de letra"
      >
        {UI_ZOOM_LEVELS.map((level) => {
          const active = level.zoom === zoom;
          return (
            <button
              key={level.zoom}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(level.zoom)}
              className={`tap flex flex-col items-center justify-end gap-1 rounded-xl border px-2 pb-2 pt-2.5 transition ${
                active
                  ? "border-terra bg-terra/[0.07] text-terra"
                  : "border-black/10 bg-bg text-dark hover:bg-black/[0.03]"
              }`}
            >
              <span
                className="font-display font-semibold leading-none"
                // El muestrario se dibuja a su tamaño real RELATIVO al zoom
                // actual: si no, al elegir "Grande" los tres crecerían juntos
                // y dejarían de compararse entre sí.
                style={{ fontSize: `${(22 * level.zoom) / zoom}px` }}
              >
                Aa
              </span>
              <span className="text-[11px] font-medium">{level.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
