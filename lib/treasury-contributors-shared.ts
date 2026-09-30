import type { LedgerMember, TreasuryContributor } from "./treasury-ledger";

/**
 * Lo PURO del padrón de contribuyentes (075): tipos y comparación de
 * nombres. Sin `server-only`, porque lo importa el componente de cliente
 * de la pantalla (para filtrar mientras se escribe) además del servidor.
 * Las consultas viven en treasury-contributors.ts.
 */

export type ContributorStats = {
  count: number;
  /** Por moneda, solo aportes vigentes (sin anulados). */
  totals: Array<{ currency: string; amount: number }>;
  lastDate: string | null;
  /** Aportes con recibo emitido: fusionar los mueve igual (075). */
  issued: number;
};

export type ContributorRow = TreasuryContributor & {
  notes: string | null;
  stats: ContributorStats;
  /** El creyente vinculado, si está en el padrón que ve el libro. */
  profileName: string | null;
  /** Creyente de la app cuyo nombre se parece, para una ficha suelta. */
  suggestedProfile: LedgerMember | null;
  /** Otras fichas que parecen la misma persona. */
  lookalikes: Array<{ id: string; name: string }>;
};

/** Sin acentos, minúsculas, sin tratamientos ni signos: lo que compara. */
export function normalizeContributorName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sr|sra|srta|dr|dra|don|dona|doña|flia|familia|fam)\.?\s+/g, " ")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Las palabras de un nombre normalizado, sin las de una letra. */
function tokens(n: string): string[] {
  return n.split(" ").filter((t) => t.length > 1);
}

/**
 * Dos nombres "parecen la misma persona" si uno contiene al otro o si
 * comparten al menos dos palabras (nombre y apellido). "Carlos Cardona" y
 * "Sr. Carlos Cardona" sí; "Carlos" y "Carlos Pérez" no (una sola palabra
 * es demasiado poco para sugerir una fusión).
 */
export function namesLookAlike(a: string, b: string): boolean {
  const na = normalizeContributorName(a);
  const nb = normalizeContributorName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = tokens(na);
  const tb = tokens(nb);
  if (ta.length >= 2 && tb.length >= 2) {
    const shared = ta.filter((t) => tb.includes(t)).length;
    if (shared >= 2) return true;
  }
  return (na.includes(nb) && tb.length >= 2) || (nb.includes(na) && ta.length >= 2);
}
