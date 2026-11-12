"use client";

import { useState } from "react";
import { UI_THEME_COOKIE, UI_THEMES, type UiTheme } from "@/lib/ui-theme";

/**
 * Selector del tema de color (ver lib/ui-theme.ts). Al tocar uno la app
 * entera cambia al instante (atributo `data-theme` en <html>) y la cookie
 * queda para la próxima carga. Cada botón lleva su propio `data-theme`,
 * así la miniatura se pinta con los colores de ESE tema y la persona
 * compara antes de elegir.
 */
export function UiThemeControl({ initial }: { initial: UiTheme }) {
  const [theme, setTheme] = useState<UiTheme>(initial);

  function choose(id: UiTheme) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    document.cookie = `${UI_THEME_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-card-soft">
      <div className="text-[13.5px] font-semibold text-dark">Colores</div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
        Cambia los colores de la app. Se guarda en este dispositivo.
      </p>
      <div
        className="mt-3 grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Colores de la app"
      >
        {UI_THEMES.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(t.id)}
              className={`tap flex flex-col items-center gap-1.5 rounded-xl border px-2 pb-2 pt-2 transition ${
                active
                  ? "border-terra bg-terra/[0.07] text-terra"
                  : "border-black/10 text-dark hover:bg-black/[0.03]"
              }`}
            >
              {/* Miniatura de una pantalla: encabezado dorado, una tarjeta
                  con texto y un botón del color de acento. */}
              <span
                data-theme={t.id}
                aria-hidden
                className="block w-full overflow-hidden rounded-lg border border-black/10 bg-bg"
              >
                <span className="block h-3 bg-gold-grad" />
                <span className="block space-y-1 px-1.5 py-1.5">
                  <span className="block rounded bg-card px-1 py-1 shadow-card-soft">
                    <span className="block h-[3px] w-3/4 rounded-full bg-dark" />
                    <span className="mt-[3px] block h-[3px] w-1/2 rounded-full bg-muted/60" />
                  </span>
                  <span className="block h-2 w-1/2 rounded-full bg-terra" />
                </span>
              </span>
              <span className="text-[11px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
