"use client";

import { useState } from "react";
import type { StudyMaterial } from "@/lib/types";

type Props = { oracion: StudyMaterial };

/**
 * Tarjeta grande con la Oración del mes. Permite descargar la imagen
 * o compartirla nativamente (Web Share API). Fallback: abre WhatsApp
 * Web con la URL.
 */
export function OracionDelMesCard({ oracion }: Props) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (!oracion.image_url) return;
    setSharing(true);

    const shareText = `${oracion.title} 🌟`;
    const shareUrl = oracion.image_url;

    try {
      // 1) Intentar compartir el archivo directamente (mejor UX en mobile).
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          const res = await fetch(shareUrl);
          const blob = await res.blob();
          const file = new File([blob], "oracion-del-mes.jpg", {
            type: blob.type || "image/jpeg",
          });
          if (
            "canShare" in navigator &&
            navigator.canShare?.({ files: [file] })
          ) {
            await navigator.share({
              files: [file],
              title: oracion.title,
              text: shareText,
            });
            return;
          }
          // Fallback Web Share sin archivo
          await navigator.share({
            title: oracion.title,
            text: shareText,
            url: shareUrl,
          });
          return;
        } catch {
          // Continúa al fallback WhatsApp
        }
      }
      // 2) Fallback: WhatsApp con la URL
      const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
      window.open(wa, "_blank", "noopener");
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
        Oración del mes
      </h2>
      <article className="overflow-hidden rounded-2xl bg-card shadow-card">
        {oracion.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={oracion.image_url}
            alt={oracion.title}
            className="block w-full"
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-bg text-[12px] text-muted">
            (Aún no se ha subido la imagen del mes)
          </div>
        )}
        <div className="p-4">
          <h3 className="font-display text-[17px] font-semibold leading-[1.25] text-dark">
            {oracion.title}
          </h3>
          {oracion.subtitle && (
            <p className="mt-0.5 text-[11.5px] text-muted">{oracion.subtitle}</p>
          )}
          {oracion.image_url && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={oracion.image_url}
                download
                target="_blank"
                rel="noopener"
                className="tap inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar
              </a>
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                className="tap inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-2 text-[12px] font-semibold text-white shadow-card-soft disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.78 11.78 0 0 0 12 0a11.84 11.84 0 0 0-10.3 17.7L0 24l6.54-1.71A11.83 11.83 0 0 0 24 12a11.79 11.79 0 0 0-3.48-8.52ZM12 21.78a9.79 9.79 0 0 1-5-1.36l-.36-.22-3.88 1 1-3.78-.24-.39A9.78 9.78 0 1 1 12 21.78Zm5.37-7.35c-.29-.15-1.7-.84-2-.93s-.46-.15-.65.15-.74.93-.9 1.12-.34.22-.63.08a8 8 0 0 1-2.36-1.46 8.85 8.85 0 0 1-1.63-2c-.17-.3 0-.46.13-.6s.29-.34.43-.51a2 2 0 0 0 .29-.48.55.55 0 0 0 0-.52c-.07-.15-.65-1.57-.9-2.15s-.47-.49-.65-.5h-.55a1.06 1.06 0 0 0-.77.36 3.26 3.26 0 0 0-1 2.41 5.62 5.62 0 0 0 1.19 3 13 13 0 0 0 5 4.4 5.61 5.61 0 0 0 3.44.72 2.93 2.93 0 0 0 1.93-1.36 2.41 2.41 0 0 0 .17-1.36c-.07-.13-.27-.21-.56-.36Z" />
                </svg>
                Compartir por WhatsApp
              </button>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
