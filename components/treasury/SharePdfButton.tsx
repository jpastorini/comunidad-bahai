"use client";

import { useState } from "react";

/**
 * "Enviar por WhatsApp" de la hoja interna: baja el PDF de
 * /admin/informe/<id>/pdf y lo pasa al menú de compartir del teléfono
 * como ARCHIVO, con el link a la hoja en el texto. Sin compartir archivos
 * (la PC, casi siempre), lo descarga.
 *
 * El PDF tarda un par de segundos en generarse, y Safari en iPhone solo
 * deja abrir el menú de compartir cerca del toque: si para cuando llega
 * el archivo ya no lo deja (NotAllowedError), el botón queda en "Enviar
 * el PDF" con el archivo listo y el segundo toque lo comparte al
 * instante.
 */
export function SharePdfButton({ reportId, title }: { reportId: string; title: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);

  const text = () =>
    `Informe de Tesorería · ${title} (uso interno de la Asamblea). ` +
    `También en la app: ${window.location.origin}/admin/informe/${reportId}`;

  async function getFile(): Promise<File> {
    if (file) return file;
    const res = await fetch(`/admin/informe/${reportId}/pdf`, { cache: "no-store" });
    if (!res.ok) throw new Error(`PDF ${res.status}`);
    const name =
      /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
      "Informe-Tesoreria.pdf";
    const f = new File([await res.blob()], name, { type: "application/pdf" });
    setFile(f);
    return f;
  }

  async function onClick() {
    setState("loading");
    let f: File;
    try {
      f = await getFile();
    } catch (err) {
      console.error("[SharePdfButton]", err);
      setState("error");
      return;
    }

    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: `Informe de Tesorería · ${title}`, text: text() });
        setState("idle");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState("idle");
          return;
        }
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setState("ready");
          return;
        }
        // Otro fallo: cae a descargar.
      }
    }

    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setState("idle");
  }

  const label =
    state === "loading"
      ? "Preparando el PDF…"
      : state === "ready"
        ? "Enviar el PDF"
        : state === "error"
          ? "No se pudo armar el PDF · reintentar"
          : "Enviar por WhatsApp";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      className="tap inline-flex items-center gap-2 rounded-xl border border-terra/25 bg-white px-4 py-2 text-[13px] font-semibold text-terra shadow-card-soft hover:bg-terra/[0.05] disabled:opacity-60"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M12 17v-6" />
        <path d="m9.5 13.5 2.5-2.5 2.5 2.5" />
      </svg>
      {label}
    </button>
  );
}
