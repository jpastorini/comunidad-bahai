"use client";

import { useState } from "react";

/**
 * Compartir un informe de Tesorería fuera de la app: share sheet nativo
 * en el celular, copiar el link en PC. El link es /i/<token>, servido sin
 * login (mismo esquema que el Boletín en /b/<token>).
 */
export function ShareReportButton({
  token,
  title,
  className,
  children,
}: {
  token: string;
  title: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/i/${token}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Informe de Tesorería · ${title}`, url });
        return;
      } catch {
        // Cancelado por el usuario → no hacemos nada.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link del informe:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={
        className ??
        "tap inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
      }
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      </svg>
      {copied ? "¡Link copiado!" : (children ?? "Compartir")}
    </button>
  );
}
