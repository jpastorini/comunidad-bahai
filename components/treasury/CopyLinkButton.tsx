"use client";

import { useState } from "react";

/**
 * Copia al portapapeles un link INTERNO de la app (una ruta, no un token
 * público). Se usa para pasarle a los miembros de la Asamblea el informe
 * que tienen que aprobar: la ruta exige login y la RLS decide quién la
 * puede abrir, así que copiar el link no expone nada.
 *
 * Deliberadamente distinto de ShareReportButton, que comparte el link
 * PÚBLICO del informe de la comunidad: mezclar los dos sería la forma
 * más fácil de filtrar un informe interno.
 */
export function CopyLinkButton({
  path,
  label = "Copiar link",
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "tap inline-flex items-center gap-2 rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
      }
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
      {copied ? "¡Link copiado!" : label}
    </button>
  );
}
