"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ConfirmSubmit } from "./confirm-submit";

/**
 * Tarjeta del link de invitación de la localidad: compartir/copiar el
 * link, ver el QR (para imprimir y llevar a la Fiesta) y regenerarlo
 * si se filtró. El link incorpora automáticamente a quien lo abre.
 */
export function InviteCard({
  path,
  localityName,
  regenerateAction,
}: {
  path: string;
  localityName: string;
  regenerateAction: (formData: FormData) => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
    setQrDataUrl(null);
    setShowQr(false);
  }, [path]);

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Comunidad Bahá'í de ${localityName}`,
          text: `Sumate a la app de la Comunidad Bahá'í de ${localityName}:`,
          url,
        });
        return;
      } catch {
        return; // cancelado por el usuario
      }
    }
    copy();
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link de invitación:", url);
    }
  }

  async function toggleQr() {
    if (showQr) {
      setShowQr(false);
      return;
    }
    if (!qrDataUrl && url) {
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 512,
          margin: 2,
          color: { dark: "#403A2E", light: "#FFFFFF" },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("[invite] QR error:", err);
        return;
      }
    }
    setShowQr(true);
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[16px] font-semibold text-dark">
            Link de invitación
          </div>
          <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-muted">
            Compartilo por WhatsApp o imprimí el QR. Quien lo abra entra con
            su cuenta y queda incorporado a {localityName} automáticamente,
            con una bienvenida guiada paso a paso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="tap rounded-xl bg-terra px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-card-soft"
          >
            Compartir
          </button>
          <button
            type="button"
            onClick={copy}
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          >
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
          <button
            type="button"
            onClick={toggleQr}
            className="tap rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-dark hover:bg-bg"
          >
            {showQr ? "Ocultar QR" : "Ver QR"}
          </button>
        </div>
      </div>

      {url && (
        <div className="mt-3 truncate rounded-xl bg-bg/70 px-3 py-2 font-mono text-[11px] text-muted">
          {url}
        </div>
      )}

      {showQr && qrDataUrl && (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl bg-bg/50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR de invitación a ${localityName}`}
            className="h-52 w-52 rounded-lg bg-white p-2 shadow-card-soft"
          />
          <p className="text-center text-[11px] text-muted">
            Guardá la imagen (mantené presionado / clic derecho) para
            imprimirla o proyectarla en la Fiesta.
          </p>
        </div>
      )}

      <form
        action={regenerateAction}
        className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3"
      >
        <span className="text-[11.5px] text-muted">
          ¿Se compartió donde no debía? Generá un link nuevo.
        </span>
        <ConfirmSubmit
          message="El link y el QR actuales dejarán de funcionar y tendrás que compartir los nuevos. ¿Regenerar?"
          className="tap shrink-0 rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12px] font-semibold text-dark hover:bg-bg"
        >
          Regenerar link
        </ConfirmSubmit>
      </form>
    </div>
  );
}
