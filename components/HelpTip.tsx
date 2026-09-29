"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Un "?" chico que abre una explicación corta. Para el panel de la
 * Tesorería, pensado para quien agarra el cargo sin conocer la app: la
 * ayuda vive al lado del control, no en un manual.
 *
 * Se abre con un toque (en el celular no hay hover) y se cierra tocando
 * afuera, con Escape o volviendo a tocar. Sin dependencias: un botón y
 * un panel absoluto.
 */
export function HelpTip({
  text,
  title,
  className = "",
}: {
  text: string;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrap} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={title ? `Ayuda: ${title}` : "Ayuda"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[11px] font-bold leading-none transition ${
          open
            ? "border-terra bg-terra text-white"
            : "border-black/20 bg-card text-muted hover:border-terra hover:text-terra"
        }`}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-[24px] z-30 w-[260px] rounded-xl border border-black/[0.08] bg-card p-3 text-left text-[12.5px] font-normal leading-relaxed text-dark shadow-card-elevated sm:w-[300px]"
        >
          {title && <span className="mb-1 block font-semibold">{title}</span>}
          {text}
        </span>
      )}
    </span>
  );
}
