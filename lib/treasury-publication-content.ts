import type { ProgressData, ProgressMoney } from "./treasury-progress-content";
import { formatReceiptDate } from "./treasury-format";

/**
 * El estado del Fondo que el tesorero calcula y comparte (066) — tipos y
 * helpers puros, sin queries, para que los componentes de cliente y el
 * PDF de la Fiesta puedan importarlos.
 *
 * La foto es lo ÚNICO que la comunidad ve de la Tesorería: /tesoreria, la
 * pantalla de la Fiesta, el deck y el folleto leen esto y nada más. No se
 * recalcula al renderizar: dice lo que decía cuando el tesorero la
 * compartió, con esa fecha.
 */

/** El mes bahá'í que contiene la fecha de corte, hasta esa fecha. */
export type PublicationMonth = {
  name: string;
  from: string;
  /** = asOf. */
  to: string;
  /** El mes ya terminó en la fecha de corte (no es un mes a medias). */
  complete: boolean;
  /** Por moneda, nunca sumadas. Sin transferencias ni aperturas. */
  income: ProgressMoney[];
  expenses: ProgressMoney[];
  contributions: number;
};

export type PublicationSnapshot = {
  /** Versión del molde, por si algún día cambia la forma de la foto. */
  v: 1;
  asOf: string;
  month: PublicationMonth | null;
  /** El tablero del ejercicio (pauta, meses, categorías, metas, saldos). */
  progress: ProgressData | null;
};

export type TreasuryPublication = {
  id: string;
  status: "draft" | "published";
  as_of: string;
  snapshot: PublicationSnapshot;
  calculated_at: string;
  published_at: string | null;
};

/** Fecha y hora de Montevideo de un timestamptz: "24/09/2026 18:05". */
export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Solo la fecha de Montevideo de un timestamptz: "24/09/2026". */
export function formatStampDate(iso: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Compartido el 24/09/2026 · movimientos hasta el 20/09/2026". */
export function publicationLabel(p: {
  as_of: string;
  published_at: string | null;
  calculated_at: string;
}): string {
  const when = p.published_at
    ? `Compartido el ${formatStampDate(p.published_at)}`
    : `Calculado el ${formatStampDate(p.calculated_at)}`;
  return `${when} · movimientos hasta el ${formatReceiptDate(p.as_of)}`;
}

/** Monto redondeado a pesos enteros, con la moneda si no es UYU. */
export function fmtAmount(m: ProgressMoney): string {
  const n = Math.round(m.amount).toLocaleString("es-UY");
  return m.currency === "UYU" ? `$ ${n}` : `${m.currency} ${n}`;
}

/** Varias monedas en una línea: "$ 12.300 · USD 150". "—" si no hay nada. */
export function fmtAmounts(list: ProgressMoney[]): string {
  return list.length > 0 ? list.map(fmtAmount).join(" · ") : "—";
}
