"use client";

import { useRef, useState } from "react";
import { formatMoney } from "@/lib/treasury-format";
import { shareNodeAsImage } from "@/lib/share-image";
import { markReceiptIssuedAction } from "../../libro/actions";

type Props = {
  id: string;
  receiptNumber: number | null;
  dateLabel: string;
  contributor: string;
  currency: string;
  amount: number;
  destination: string;
  localityName: string;
  treasurerName: string;
  issued: boolean;
  hasLogo: boolean;
  hasSignature: boolean;
};

/**
 * Recibo de contribución, en hoja A5.
 *
 * Reemplaza al generador que vivía en Apps Script sobre la planilla.
 * Dos caminos de salida, según dónde esté el tesorero:
 *   · Imprimir → el diálogo del navegador permite "Guardar como PDF",
 *     que es lo que se hacía antes. Sale en A5 exacto.
 *   · Compartir → captura el recibo como PNG y lo manda por la hoja de
 *     compartir del sistema (WhatsApp). En el teléfono es un toque,
 *     contra los cuatro que exige guardar un PDF y después adjuntarlo.
 *
 * El logo y la firma son opcionales: si los archivos no están, el recibo
 * se emite igual, como hacía el script original.
 */
export function ReceiptView({
  id,
  receiptNumber,
  dateLabel,
  contributor,
  currency,
  amount,
  destination,
  localityName,
  treasurerName,
  issued,
  hasLogo,
  hasSignature,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [isIssued, setIsIssued] = useState(issued);
  const [notice, setNotice] = useState<string | null>(null);

  const fileName = `Recibo${receiptNumber ?? ""}.png`;

  async function share() {
    if (!sheetRef.current) return;
    setSharing(true);
    setNotice(null);
    const result = await shareNodeAsImage(sheetRef.current, {
      filename: fileName,
      title: `Recibo N.° ${receiptNumber ?? ""}`,
      text: `Recibo de contribución — ${localityName}`,
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
      {/* Al imprimir queda solo la hoja: el panel entero se esconde. */}
      <style>{`
        @page { size: A5 portrait; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #recibo, #recibo * { visibility: visible !important; }
          #recibo {
            position: absolute;
            left: 0; top: 0;
            margin: 0;
            box-shadow: none;
          }
        }
      `}</style>

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

      {/* ─── La hoja A5 ─── */}
      {/* El centrado va en el envoltorio: la hoja capturada no puede
          tener márgenes automáticos (ver lib/share-image.ts). */}
      <div className="flex justify-center">
      <div
        id="recibo"
        ref={sheetRef}
        className="flex flex-col overflow-hidden bg-[#fffdf7] shadow-card-elevated"
        style={{ width: "148mm", height: "210mm" }}
      >
        <header
          className="shrink-0 px-6 pb-5 pt-7 text-center"
          style={{
            background:
              "linear-gradient(160deg, #7a3b1e 0%, #a0522d 55%, #c47a3a 100%)",
          }}
        >
          {hasLogo && (
            <div className="mx-auto mb-3 flex h-[52px] w-[92px] items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/recibo/logo.png"
                alt="El Más Grande Nombre"
                className="h-[34px] w-[34px] object-contain brightness-0 invert"
              />
            </div>
          )}
          <h1 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#fff8ee]">
            Asamblea Espiritual Local de los Bahá'ís de
          </h1>
          <h2 className="font-display text-[24px] font-semibold leading-tight text-[#ffecd0]">
            {localityName}
          </h2>
          <p className="text-[12px] italic text-[#fff0d2]/80">
            Tesorería — Comprobante de Contribución
          </p>
        </header>

        <div className="flex shrink-0 items-center justify-between border-b border-[#e0c9a6] bg-[#f5ede0] px-7 py-2 text-[11.5px] text-[#8b5e2a]">
          <span>
            Recibo N.° <strong>{receiptNumber ?? "—"}</strong>
          </span>
          <span>
            Fecha: <strong>{dateLabel}</strong>
          </span>
        </div>

        <div className="min-h-0 flex-1 px-7 py-5">
          <blockquote className="mb-5 rounded-r-lg border-l-[3px] border-[#c47a3a] bg-[#fdf3e3] px-4 py-3">
            <p className="mb-1.5 text-[11.5px] italic leading-[1.55] text-[#6b3e1e]">
              «La importancia de contribuir reside en el grado de sacrificio del
              donante, el espíritu de la devoción con que se hace la contribución
              y la unidad de los amigos en este servicio; Éstos atraen las
              confirmaciones de Dios y mejoran la dignidad y la autoestima de los
              individuos y la comunidad.»
            </p>
            <p className="text-right text-[11px] text-[#a0682a]">
              — Casa Universal de Justicia
            </p>
          </blockquote>

          <Field label="Nombre del contribuyente" value={contributor} />

          <div className="grid grid-cols-2 gap-x-6">
            <Field label="Moneda" value={currency} />
            <Field label="Monto" value={formatMoney(amount)} />
          </div>

          <Field label="Destino" value={destination} />

          <hr className="my-4 border-t border-dashed border-[#d4a96a]" />

          <div className="mt-1 flex justify-center">
            <div className="flex w-[200px] flex-col items-center gap-1">
              {hasSignature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/recibo/firma.png"
                  alt=""
                  className="mt-4 max-h-[46px] max-w-[170px] object-contain"
                />
              ) : (
                <div className="min-h-[34px] w-full" />
              )}
              <div className="w-full border-t border-[#b8884a]" />
              <span className="text-[10px] uppercase tracking-[0.06em] text-[#9b6530]">
                Tesorero/a de la Asamblea
              </span>
              <span className="text-[12px] italic text-[#5a3010]">
                {treasurerName}
              </span>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#e0c9a6] bg-[#f5ede0] px-7 py-3 text-center">
          <p className="tracking-[0.3em] text-[#c47a3a]">· · ✦ · ·</p>
          <p className="text-[10px] italic leading-[1.5] text-[#9b6530]">
            Las contribuciones a los fondos bahá'ís son voluntarias y
            estrictamente confidenciales.
            <br />
            Este recibo es un comprobante oficial emitido por la Tesorería de la
            Asamblea.
          </p>
        </footer>
      </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 flex flex-col gap-0.5">
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-[#9b6530]">
        {label}
      </span>
      <div className="min-h-[26px] border-b border-[#c9a46a] px-0.5 pb-1 pt-0.5 text-[15px] leading-snug text-[#3d1f08]">
        {value}
      </div>
    </div>
  );
}
