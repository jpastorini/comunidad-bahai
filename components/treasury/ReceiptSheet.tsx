"use client";

import { forwardRef } from "react";
import {
  DEFAULT_TREASURER_TITLE,
  receiptPalette,
  type ReceiptTheme,
} from "@/lib/receipt-theme";
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
  /** Quién firma. Lo resuelve la base (`receipt_signer_name`, 060), la
   *  MISMA función para las dos caras del papel. */
  treasurerName: string;
  /** El renglón sobre el nombre. Por defecto "Tesorero/a de la Asamblea". */
  treasurerTitle?: string | null;
  hasLogo: boolean;
  /** URL firmada de la firma escaneada de ESTA comunidad (060). Hasta la
   *  060 era un archivo del repo, el mismo para todo el país. */
  signatureUrl?: string | null;
  /** El color del recibo, por comunidad: la Tesorería Nacional los emite
   *  en azul oscuro. */
  theme?: ReceiptTheme | string | null;
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
 * El logo es opcional: si el archivo no está, el recibo se emite igual,
 * como hacía el script original. El logo SÍ sigue siendo común a todas
 * las comunidades, porque el Más Grande Nombre es de la Fe y no de una
 * Asamblea; la firma, no (060).
 *
 * Desde la 054 lleva los datos fiscales que pide la DGI para un recibo
 * de donación (nombre registrado, RUT, domicilio) y la leyenda "Recibo",
 * y dice al pie que lo emitió el sistema de Tesorería. Lo que reemplaza a
 * los "datos de imprenta" en un recibo emitido por sistema es una
 * pregunta abierta al contador (ver CLAUDE.md).
 *
 * ⚠️ Ni un color queda escrito acá: todos salen de `receiptPalette()`
 * (lib/receipt-theme.ts). Si agregás un elemento con color propio, sumale
 * su token al tema o va a quedar terracota en los cuatro.
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
      treasurerTitle,
      hasLogo,
      signatureUrl,
      theme,
      legal,
      voided = false,
    },
    ref
  ) {
    const c = receiptPalette(theme);

    const legalLine = [
      legal?.rut ? `RUT ${legal.rut}` : null,
      legal?.address ?? null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <>
        {/* Al imprimir queda solo la hoja: el resto de la pantalla se esconde.
            `print-color-adjust` es lo que evita que el navegador tire el
            degradé del encabezado y las bandas, que con el tema elegido
            son justamente lo que distingue a una comunidad de otra. */}
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
            #recibo, #recibo * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>

        <div className="flex justify-center">
          <div
            id="recibo"
            ref={ref}
            className="relative flex flex-col overflow-hidden shadow-card-elevated"
            style={{ width: "148mm", height: "210mm", background: c.paper }}
          >
            <header
              className="shrink-0 px-6 pb-5 pt-7 text-center"
              style={{
                background: `linear-gradient(160deg, ${c.gradFrom} 0%, ${c.gradVia} 55%, ${c.gradTo} 100%)`,
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
                <h1
                  className="mb-1 font-display text-[19px] font-semibold leading-tight"
                  style={{ color: c.onDark }}
                >
                  {legal.registeredName}
                </h1>
              ) : (
                <>
                  <h1
                    className="mb-1 text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: c.onDarkSoft }}
                  >
                    Asamblea Espiritual Local de los Bahá&apos;ís de
                  </h1>
                  <h2
                    className="font-display text-[24px] font-semibold leading-tight"
                    style={{ color: c.onDark }}
                  >
                    {localityName}
                  </h2>
                </>
              )}
              {legalLine && (
                <p
                  className="mt-1 text-[10.5px] tracking-[0.02em]"
                  style={{ color: c.onDarkFaint, opacity: 0.9 }}
                >
                  {legalLine}
                </p>
              )}
              <p
                className="mt-0.5 text-[12px] italic"
                style={{ color: c.onDarkFaint, opacity: 0.8 }}
              >
                Tesorería — Comprobante de Contribución
              </p>
            </header>

            <div
              className="flex shrink-0 items-center justify-between border-b px-7 py-2 text-[11.5px]"
              style={{
                background: c.bandBg,
                borderColor: c.bandBorder,
                color: c.bandText,
              }}
            >
              <span>
                <strong className="mr-1 uppercase tracking-[0.06em]">Recibo</strong>
                N.° <strong>{receiptNumber ?? "—"}</strong>
              </span>
              <span>
                Fecha: <strong>{dateLabel}</strong>
              </span>
            </div>

            <div className="min-h-0 flex-1 px-7 py-5">
              <blockquote
                className="mb-5 rounded-r-lg border-l-[3px] px-4 py-3"
                style={{ background: c.quoteBg, borderColor: c.quoteBar }}
              >
                <p
                  className="mb-1.5 text-[11.5px] italic leading-[1.55]"
                  style={{ color: c.quoteText }}
                >
                  «La importancia de contribuir reside en el grado de sacrificio
                  del donante, el espíritu de la devoción con que se hace la
                  contribución y la unidad de los amigos en este servicio; Éstos
                  atraen las confirmaciones de Dios y mejoran la dignidad y la
                  autoestima de los individuos y la comunidad.»
                </p>
                <p className="text-right text-[11px]" style={{ color: c.quoteAttr }}>
                  — Casa Universal de Justicia
                </p>
              </blockquote>

              <Field label="Nombre del contribuyente" value={contributor} c={c} />

              <div className="grid grid-cols-2 gap-x-6">
                <Field label="Moneda" value={currency} c={c} />
                <Field label="Monto" value={formatMoney(amount)} c={c} />
              </div>

              <Field label="Destino" value={destination} c={c} />

              <hr
                className="my-4 border-t border-dashed"
                style={{ borderColor: c.dash }}
              />

              <div className="mt-1 flex justify-center">
                <div className="flex w-[200px] flex-col items-center gap-1">
                  {signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signatureUrl}
                      alt=""
                      crossOrigin="anonymous"
                      className="mt-4 max-h-[46px] max-w-[170px] object-contain"
                    />
                  ) : (
                    // Sin firma cargada el renglón queda en blanco, para
                    // firmar a mano. Es lo correcto: antes salía la firma
                    // del tesorero de Montevideo en el recibo de cualquiera.
                    <div className="min-h-[34px] w-full" />
                  )}
                  <div className="w-full border-t" style={{ borderColor: c.signRule }} />
                  <span
                    className="text-[10px] uppercase tracking-[0.06em]"
                    style={{ color: c.label_ }}
                  >
                    {treasurerTitle?.trim() || DEFAULT_TREASURER_TITLE}
                  </span>
                  <span className="text-[12px] italic" style={{ color: c.signName }}>
                    {treasurerName}
                  </span>
                </div>
              </div>
            </div>

            <footer
              className="shrink-0 border-t px-7 py-3 text-center"
              style={{ background: c.bandBg, borderColor: c.bandBorder }}
            >
              <p className="tracking-[0.3em]" style={{ color: c.ornament }}>
                · · ✦ · ·
              </p>
              <p
                className="text-[10px] italic leading-[1.5]"
                style={{ color: c.label_ }}
              >
                Las contribuciones a los fondos bahá&apos;ís son voluntarias y
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

function Field({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof receiptPalette>;
}) {
  return (
    <div className="mb-4 flex flex-col gap-0.5">
      <span
        className="text-[9.5px] uppercase tracking-[0.1em]"
        style={{ color: c.label_ }}
      >
        {label}
      </span>
      <div
        className="min-h-[26px] border-b px-0.5 pb-1 pt-0.5 text-[15px] leading-snug"
        style={{ borderColor: c.rule, color: c.value }}
      >
        {value}
      </div>
    </div>
  );
}
