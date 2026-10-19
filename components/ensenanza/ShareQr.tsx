"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export type ShareItem = {
  key: string;
  /** Rótulo corto para la pestaña. */
  label: string;
  title: string;
  description: string;
  /** URL absoluta, o `path` relativo que se resuelve con el origin actual. */
  url?: string;
  path?: string;
  /** Texto que acompaña al link al compartirlo por WhatsApp. */
  shareText: string;
};

/**
 * Compartir: un QR grande por vez, para que otro celular lo escanee desde
 * el tuyo. Fondo blanco pleno y módulos oscuros, sin logo encima: el caso
 * de uso es una charla cara a cara, con la pantalla del teléfono a medio
 * brillo y a veces al sol. "Enviar" usa el share nativo (WhatsApp) para
 * cuando la otra persona no está al lado o no sabe escanear.
 */
export function ShareQr({ items }: { items: ShareItem[] }) {
  const [active, setActive] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);

  // Las URL relativas se resuelven en el navegador: el QR tiene que
  // apuntar al host real (producción o vista previa), no a uno fijo.
  useEffect(() => {
    const resolved = items.map((it) => it.url ?? `${window.location.origin}${it.path ?? "/"}`);
    setUrls(resolved);
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (let i = 0; i < items.length; i++) {
        try {
          out[items[i].key] = await QRCode.toDataURL(resolved[i], {
            width: 720,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#1E1B26", light: "#FFFFFF" },
          });
        } catch (err) {
          console.error("[compartir] QR error:", err);
        }
      }
      if (alive) setQrs(out);
    })();
    return () => {
      alive = false;
    };
  }, [items]);

  const item = items[active];
  const url = urls[active];
  const qr = qrs[item?.key];

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text: item.shareText, url });
        return;
      } catch {
        return; // cancelado
      }
    }
    copy();
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  return (
    <div>
      {/* Pestañas: una por link. */}
      <div className="mb-3 flex gap-1 rounded-full bg-black/[0.04] p-1" data-no-pull>
        {items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setActive(i)}
            aria-current={i === active ? "true" : undefined}
            className={`tap flex-1 truncate rounded-full px-2 py-1.5 text-[11.5px] ${
              i === active ? "bg-card font-semibold text-terra shadow-card-soft" : "font-medium text-muted"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-card">
        <button
          type="button"
          onClick={() => qr && setFull(true)}
          aria-label="Ver el código en pantalla completa"
          className="tap mx-auto block w-full max-w-[320px] rounded-2xl bg-white p-3 ring-1 ring-black/[0.06]"
        >
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`Código QR de ${item.title}`} className="block h-auto w-full" />
          ) : (
            <div className="cb-shimmer aspect-square w-full rounded-xl bg-black/[0.04]" />
          )}
        </button>
        <div className="mt-3 text-center">
          <div className="font-display text-[18px] font-semibold text-dark">{item.title}</div>
          <p className="mt-0.5 font-body text-[12.5px] leading-relaxed text-muted">
            {item.description}
          </p>
          {url && (
            <p className="mt-1.5 truncate font-body text-[11.5px] text-terra">{shortUrl(url)}</p>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={share}
            className="tap flex-1 rounded-2xl bg-terra px-3 py-2.5 text-[13px] font-semibold text-white shadow-card-soft"
          >
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            onClick={copy}
            className="tap rounded-2xl bg-black/[0.05] px-3 py-2.5 text-[13px] font-semibold text-dark"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          Tocá el código para verlo en grande.
        </p>
      </div>

      {/* Pantalla completa: blanco pleno, el QR al máximo. Un toque cierra. */}
      {full && qr && (
        <div
          role="dialog"
          aria-label={`Código QR de ${item.title}`}
          onClick={() => setFull(false)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white px-6"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" className="block w-full max-w-[520px]" />
          <div className="mt-4 text-center">
            <div className="font-display text-[22px] font-semibold text-dark">{item.title}</div>
            <div className="mt-1 font-body text-[13px] text-muted">{shortUrl(url ?? "")}</div>
            <div className="mt-6 text-[12px] text-muted">Tocá para volver</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Sin protocolo ni token largo: lo que una persona lee de un vistazo. */
function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    const path = x.pathname.length > 28 ? x.pathname.slice(0, 26) + "…" : x.pathname;
    return `${x.host}${path === "/" ? "" : path}`;
  } catch {
    return u;
  }
}
