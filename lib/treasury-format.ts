// Helpers de dinero compartidos entre servidor y cliente.
//
// Viven aparte de lib/treasury-ledger.ts porque ese módulo es server-only
// (hace queries): si el cliente importara algo de ahí, aunque sea una
// función pura, se arrastraría el módulo entero al bundle y el build falla.

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
