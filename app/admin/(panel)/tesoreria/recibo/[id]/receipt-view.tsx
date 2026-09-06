"use client";

import { useRef, useState } from "react";
import { ReceiptSheet, type ReceiptSheetProps } from "@/components/treasury/ReceiptSheet";
import { shareNodeAsImage } from "@/lib/share-image";
import { markReceiptIssuedAction } from "../../libro/actions";

type Props = ReceiptSheetProps & {
  id: string;
  issued: boolean;
};

/**
 * El recibo visto por el tesorero: la hoja A5 (`ReceiptSheet`) más los
 * botones y el estado "emitido".
 *
 * Dos caminos de salida, según dónde esté el tesorero:
 *   · Imprimir → el diálogo del navegador permite "Guardar como PDF",
 *     que es lo que se hacía antes. Sale en A5 exacto.
 *   · Compartir → captura el recibo como PNG y lo manda por la hoja de
 *     compartir del sistema (WhatsApp). En el teléfono es un toque,
 *     contra los cuatro que exige guardar un PDF y después adjuntarlo.
 *
 * Cualquiera de los dos marca el recibo como emitido y registra quién lo
 * emitió, que es el nombre que va en la firma de la copia que el creyente
 * baja desde "Mis aportes".
 */
export function ReceiptView({ id, issued, ...sheet }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [isIssued, setIsIssued] = useState(issued);
  const [notice, setNotice] = useState<string | null>(null);

  const fileName = `Recibo${sheet.receiptNumber ?? ""}.png`;

  async function share() {
    if (!sheetRef.current) return;
    setSharing(true);
    setNotice(null);
    const result = await shareNodeAsImage(sheetRef.current, {
      filename: fileName,
      title: `Recibo N.° ${sheet.receiptNumber ?? ""}`,
      text: `Recibo de contribución — ${sheet.localityName}`,
    });
    setSharing(false);
    if (result === "downloaded") {
      setNotice(`Se descargó ${fileName}. Adjuntalo donde quieras enviarlo.`);
    } else if (result === "error") {
      setNotice("No se pudo generar la imagen. Probá con Imprimir.");
    } else {
      await markIssued();
    }
  }

  async function markIssued() {
    if (isIssued) return;
    const fd = new FormData();
    fd.set("id", id);
    const res = await markReceiptIssuedAction(fd);
    if (res.ok) setIsIssued(true);
    else setNotice(res.error);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            markIssued();
            window.print();
          }}
          className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white"
        >
          Imprimir o guardar PDF
        </button>
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="tap rounded-xl border border-terra/25 bg-terra/[0.06] px-4 py-2 text-[13px] font-semibold text-terra disabled:opacity-60"
        >
          {sharing ? "Preparando…" : "Compartir por WhatsApp"}
        </button>
        {isIssued ? (
          <span className="text-[12px] font-semibold text-emerald-700">
            ✓ Emitido
          </span>
        ) : (
          <button
            type="button"
            onClick={markIssued}
            className="text-[12px] font-medium text-muted underline underline-offset-2"
          >
            Marcar como emitido
          </button>
        )}
      </div>

      {notice && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          {notice}
        </p>
      )}

      <ReceiptSheet ref={sheetRef} {...sheet} />
    </>
  );
}
