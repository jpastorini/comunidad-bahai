"use client";

import { forwardRef } from "react";
import { formatMoney } from "@/lib/treasury-format";

/** Los datos fiscales de la Asamblea que la DGI pide en un recibo
 *  (Res. 688/992 num. 22): nombre registrado, RUT y domicilio fiscal. */
export type ReceiptLegalProps = {
  registeredName: string | null;
  rut: string | null;
  address: string | null;
};

export type ReceiptSheetProps = {
  receiptNumber: number | null;
  /** "22/08/2026". */
  dateLabel: string;
  /** Lo que se imprime en "Nombre del contribuyente": el seudónimo del
   *  aporte si lo hay, si no el contribuyente. */
  contributor: string;
  currency: string;
  amount: number;
  destination: string;
  localityName: string;
  treasurerName: string;
  hasLogo: boolean;
  hasSignature: boolean;
  /** Si falta, el recibo sale sin RUT ni domicilio: es lo que había hasta
   *  la 054 y lo que se ve mientras la ficha legal no esté cargada. */
  legal?: ReceiptLegalProps | null;
  /** Recibo anulado: se imprime igual, cruzado con "ANULADO". El número
   *  sigue en la serie y el papel tiene que decirlo. */
  voided?: boolean;
};

/**
 * La hoja A5 del recibo de contribución.
 *
 * Es la MISMA hoja para el tesorero (`/admin/tesoreria/recibo/[id]`) y
 * para el creyente que baja su copia desde "Mis aportes"
 * (`/perfil/aportes/recibo/[id]`): un recibo no puede verse distinto
 * según quién lo abra. Los botones y el estado "emitido" quedan en cada
 * pantalla; acá solo vive el papel.
 *
 * Reemplaza al generador que vivía en Apps Script sobre la planilla.
 * El logo y la firma son opcionales: si los archivos no están, el recibo
 * se emite igual, como hacía el script original.
 *
 * Desde la 054 lleva los datos fiscales que pide la DGI para un recibo
 * de donación (nombre registrado, RUT, domicilio) y la leyenda "Recibo",
 * y dice al pie que lo emitió el sistema de Tesorería. Lo que reemplaza a
 * los "datos de imprenta" en un recibo emitido por sistema es una
 * pregunta abierta al contador (ver CLAUDE.md).
 *
 * ⚠️ El nodo capturado como imagen no puede tener márgenes `auto` (ver
 * lib/share-image.ts): el centrado va siempre en el envoltorio.
 */
export const ReceiptSheet = forwardRef<HTMLDivElement, ReceiptSheetProps>(
  function ReceiptSheet(
    {
      receiptNumber,
      dateLabel,
      contributor,
      currency,
      amount,
      destination,
      localityName,
      treasurerName,
      hasLogo,
      hasSignature,
      legal,
      voided = false,
    },
    ref
  ) {
    const legalLine = [
      legal?.rut ? `RUT ${legal.rut}` : null,
      legal?.address ?? null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <>
        {/* Al imprimir queda solo la hoja: el resto de la pantalla se esconde. */}
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

        <div className="flex justify-center">
          <div
            id="recibo"
            ref={ref}
            className="relative flex flex-col overflow-hidden bg-[#fffdf7] shadow-card-elevated"
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
              {legal?.registeredName ? (
                <h1 className="mb-1 font-display text-[19px] font-semibold leading-tight text-[#ffecd0]">
                  {legal.registeredName}
                </h1>
              ) : (
                <>
                  <h1 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[#fff8ee]">
                    Asamblea Espiritual Local de los Bahá'ís de
                  </h1>
                  <h2 className="font-display text-[24px] font-semibold leading-tight text-[#ffecd0]">
                    {localityName}
                  </h2>
                </>
              )}
              {legalLine && (
                <p className="mt-1 text-[10.5px] tracking-[0.02em] text-[#fff0d2]/90">
                  {legalLine}
                </p>
              )}
              <p className="mt-0.5 text-[12px] italic text-[#fff0d2]/80">
                Tesorería — Comprobante de Contribución
              </p>
            </header>

            <div className="flex shrink-0 items-center justify-between border-b border-[#e0c9a6] bg-[#f5ede0] px-7 py-2 text-[11.5px] text-[#8b5e2a]">
              <span>
                <strong className="mr-1 uppercase tracking-[0.06em]">Recibo</strong>
                N.° <strong>{receiptNumber ?? "—"}</strong>
              </span>
              <span>
                Fecha: <strong>{dateLabel}</strong>
              </span>
            </div>

            <div className="min-h-0 flex-1 px-7 py-5">
              <blockquote className="mb-5 rounded-r-lg border-l-[3px] border-[#c47a3a] bg-[#fdf3e3] px-4 py-3">
                <p className="mb-1.5 text-[11.5px] italic leading-[1.55] text-[#6b3e1e]">
                  «La importancia de contribuir reside en el grado de sacrificio
                  del donante, el espíritu de la devoción con que se hace la
                  contribución y la unidad de los amigos en este servicio; Éstos
                  atraen las confirmaciones de Dios y mejoran la dignidad y la
                  autoestima de los individuos y la comunidad.»
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
                Comprobante emitido por el sistema de Tesorería de la Asamblea.
                Numeración correlativa única.
              </p>
            </footer>

            {voided && (
              <div
                aria-label="Recibo anulado"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span
                  className="rotate-[-28deg] rounded-lg border-[6px] border-[#9b1c1c]/70 px-8 py-3 font-display text-[64px] font-bold uppercase tracking-[0.18em] text-[#9b1c1c]/70"
                  style={{ letterSpacing: "0.18em" }}
                >
                  Anulado
                </span>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);

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
