// Helpers de dinero compartidos entre servidor y cliente.
//
// Viven aparte de lib/treasury-ledger.ts porque ese módulo es server-only
// (hace queries): si el cliente importara algo de ahí, aunque sea una
// función pura, se arrastraría el módulo entero al bundle y el build falla.

/**
 * "2026-08-22" → "22/08/2026", sin pasar por Date (no hay huso que corra).
 *
 * Vive acá y no en ReceiptSheet.tsx a propósito: ese archivo es
 * `"use client"`, y todo lo que se exporta de un módulo de cliente llega
 * al servidor como referencia de cliente. Llamarlo desde un server
 * component (las páginas del recibo) tiraba "Application error".
 */
export function formatReceiptDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** El encabezado del recibo dice "…de los Bahá'ís de X": se le saca el
 *  prefijo al nombre de la localidad para no repetirlo. */
export function receiptLocalityName(name: string): string {
  return name.replace(/^Comunidad Bahá'í de\s*/i, "");
}

/** Suma redondeada a centavos: evita el arrastre del punto flotante al
 *  acumular muchos movimientos. */
export function addMoney(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

/** 1234.5 → "1.234,50" (y opcionalmente con la moneda al final). */
export function formatMoney(amount: number, currency?: string): string {
  const n = amount.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${n} ${currency}` : n;
}

/**
 * "1.500,50" o "1500.50" → 1500.5; NaN si no hay número.
 *
 * El tesorero escribe como le sale y las dos convenciones conviven en la
 * misma tanda de carga. Si hay coma, la coma es el decimal y el punto
 * separa miles.
 */
export function parseMoney(raw: string): number {
  const s = (raw || "").trim();
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Math.round(parseFloat(normalized) * 100) / 100;
}
