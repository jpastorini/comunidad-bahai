"use client";

import { useRef, useState } from "react";
import { ReceiptSheet, type ReceiptSheetProps } from "@/components/treasury/ReceiptSheet";
import { shareNodeAsImage } from "@/lib/share-image";

/**
 * La hoja del recibo con los dos botones del creyente: guardar en PDF
 * (el diálogo de imprimir del navegador) o compartir/guardar como imagen.
 * Sin estado "emitido": eso es del tesorero.
 *
 * La hoja mide 148 mm de ancho, más que un celular: en pantalla angosta
 * se escala para que entre entera, y la captura sale igual a tamaño real
 * porque la imagen se genera desde el nodo, no desde lo que se ve.
 */
export function MyReceiptView(props: ReceiptSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fileName = `Recibo${props.receiptNumber ?? ""}.png`;

  async function share() {
    if (!sheetRef.current) return;
    setSharing(true);
    setNotice(null);
    const result = await shareNodeAsImage(sheetRef.current, {
      filename: fileName,
      title: `Recibo N.° ${props.receiptNumber ?? ""}`,
      text: `Recibo de contribución — ${props.localityName}`,
    });
    setSharing(false);
    if (result === "downloaded") {
      setNotice(`Se descargó ${fileName}.`);
    } else if (result === "error") {
      setNotice("No se pudo generar la imagen. Probá con Guardar PDF.");
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white"
        >
          Guardar PDF
        </button>
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="tap rounded-xl border border-terra/25 bg-terra/[0.06] px-4 py-2 text-[13px] font-semibold text-terra disabled:opacity-60"
        >
          {sharing ? "Preparando…" : "Compartir o guardar imagen"}
        </button>
      </div>

      {notice && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          {notice}
        </p>
      )}

      {/* En el celular la hoja se achica para entrar en el ancho; el
          envoltorio reserva el alto que ocupa escalada. */}
      <style>{`
        .cb-receipt-fit { --s: 1; }
        @media (max-width: 620px) {
          .cb-receipt-fit { --s: calc((100vw - 32px) / 560); }
        }
        .cb-receipt-fit > div {
          transform: scale(var(--s));
          transform-origin: top center;
        }
        .cb-receipt-fit { height: calc(794px * var(--s)); overflow: hidden; }
        @media print { .cb-receipt-fit { height: auto; overflow: visible; }
                       .cb-receipt-fit > div { transform: none; } }
      `}</style>
      <div className="cb-receipt-fit">
        <ReceiptSheet ref={sheetRef} {...props} />
      </div>
    </>
  );
}
