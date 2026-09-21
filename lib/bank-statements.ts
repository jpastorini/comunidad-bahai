/**
 * Extractos de las plataformas donde la comunidad tiene la plata (Prex,
 * BROU, Mercado Pago), leídos desde el archivo que exporta cada una.
 *
 * Este módulo NO sabe de Excel: recibe una matriz de celdas ya leída
 * (ver `lib/bank-statements-read.ts`, que es el único lugar que importa
 * SheetJS) y devuelve líneas normalizadas. Así el parser se prueba con un
 * arreglo escrito a mano y no depende de un archivo real, que trae
 * nombres de personas y no puede vivir en el repo.
 *
 * Cada plataforma exporta distinto y cambia las columnas sin avisar, por
 * eso cada parser ubica las columnas POR NOMBRE de encabezado (no por
 * posición) y, si no reconoce el archivo, falla con un mensaje claro en
 * vez de importar mal. Un extracto mal leído es peor que ninguno: la
 * pantalla diría que falta un aporte que está.
 *
 * Por ahora se lee Prex. El BROU y Mercado Pago se reconocen (para poder
 * decir "esto es del BROU, todavía no") pero no se parsean.
 */

export type StatementPlatform = "prex" | "brou" | "mercadopago";

export const PLATFORM_LABELS: Record<StatementPlatform, string> = {
  prex: "Prex",
  brou: "BROU",
  mercadopago: "Mercado Pago",
};

/** Una línea del extracto, ya normalizada. */
export type StatementLine = {
  /** Estable dentro del archivo: "L<fila>". */
  key: string;
  /** Fila del archivo (1-based), para que la persona la encuentre. */
  row: number;
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Con signo: positivo entró a la cuenta, negativo salió. Es lo que
   *  efectivamente movió el saldo. */
  amount: number;
  currency: string;
  description: string;
  /** Número de referencia de la plataforma (el de la transferencia), si
   *  la descripción lo trae. Sirve para no duplicar al re-importar. */
  reference: string | null;
  /** Prex: el importe PEDIDO cuando difiere del cobrado. Una transferencia
   *  de 5.014 se cobra 5.058,26: la comisión viene adentro del importe, no
   *  como línea aparte, y el libro la tiene como dos asientos. */
  grossAmount: number | null;
  status: string | null;
};

export type ParsedStatement = {
  platform: StatementPlatform;
  /** Solo las líneas que efectivamente movieron la cuenta, de la más
   *  vieja a la más nueva. */
  lines: StatementLine[];
  /** Filas que se dejaron afuera y por qué (pendientes, rechazadas…). */
  skipped: Array<{ row: number; reason: string }>;
  /** Rango de fechas del extracto (de las líneas leídas). */
  from: string;
  to: string;
  warnings: string[];
};

export type ParseFailure = { error: string; platform: StatementPlatform | null };

export type Cell = string | number | boolean | null | undefined;
export type CellMatrix = Cell[][];

// ─── Celdas ────────────────────────────────────────────────────────────

/** "Descripción " → "descripcion": para comparar encabezados sin que un
 *  acento o una mayúscula distinta rompan el parser. */
export function normalizeHeader(c: Cell): string {
  return String(c ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/** Fecha de una celda en ISO, o null. Acepta el serial de Excel (el BROU
 *  exporta fechas como número), "dd/mm/yyyy", "yyyy-mm-dd" y un ISO con
 *  hora (Mercado Pago: "2026-09-11T15:55:39.000-03:00"). */
export function cellDate(c: Cell): string | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") {
    if (!Number.isFinite(c) || c < 20000 || c > 80000) return null;
    return new Date(EXCEL_EPOCH_UTC + Math.floor(c) * 86400000).toISOString().slice(0, 10);
  }
  const s = String(c).trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    return isoDate(y, parseInt(m[2], 10), parseInt(m[1], 10));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return isoDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  return null;
}

function isoDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Número de una celda, o null. Un número viene tal cual; un texto puede
 * venir "-5058.26" (Prex), "1,600.00" (BROU) o "1.500,50" (planilla a
 * mano): si hay punto y coma, el ÚLTIMO es el decimal; si hay solo coma
 * seguida de uno o dos dígitos al final, es decimal; si no, separa miles.
 */
export function cellNumber(c: Cell): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return Number.isFinite(c) ? round2(c) : null;
  if (typeof c === "boolean") return null;
  let s = String(c).trim().replace(/\s/g, "").replace(/^\$/, "").replace(/^U\$S/i, "");
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-+]/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    s =
      lastComma > lastDot
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return round2(neg ? -n : n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cellText(c: Cell): string {
  return String(c ?? "").replace(/\s+/g, " ").trim();
}

/** La tira de dígitos más larga (6 o más) de la descripción: en Prex es
 *  el número de la transferencia. */
export function extractReference(description: string): string | null {
  const runs = description.match(/\d{6,}/g);
  if (!runs) return null;
  return runs.reduce((a, b) => (b.length > a.length ? b : a));
}

// ─── Detección ─────────────────────────────────────────────────────────

/** Busca la fila de encabezados de cada plataforma en las primeras 60
 *  filas. Devuelve la plataforma y en qué fila está el encabezado. */
export function detectPlatform(
  rows: CellMatrix
): { platform: StatementPlatform; headerRow: number } | null {
  const limit = Math.min(rows.length, 60);
  for (let i = 0; i < limit; i++) {
    const h = (rows[i] ?? []).map(normalizeHeader);
    const has = (name: string) => h.includes(name);
    if (has("fecha") && has("descripcion") && has("importe") && has("estado")) {
      return { platform: "prex", headerRow: i };
    }
    if (has("fecha") && has("descripcion") && has("debito") && has("credito")) {
      return { platform: "brou", headerRow: i };
    }
    if (h.some((c) => c.includes("mercado pago")) && has("tipo de operacion")) {
      return { platform: "mercadopago", headerRow: i };
    }
  }
  return null;
}

/** Punto de entrada: reconoce la plataforma y parsea si ya se sabe. */
export function parseStatement(rows: CellMatrix): ParsedStatement | ParseFailure {
  const detected = detectPlatform(rows);
  if (!detected) {
    return {
      error:
        "No reconozco el formato del archivo. Tiene que ser el que exporta la plataforma (Prex: Estado de cuenta → exportar a Excel).",
      platform: null,
    };
  }
  if (detected.platform === "prex") return parsePrex(rows, detected.headerRow);
  return {
    error: `Es un archivo de ${PLATFORM_LABELS[detected.platform]}. Por ahora la conciliación lee solo Prex; ${PLATFORM_LABELS[detected.platform]} viene en el próximo paso.`,
    platform: detected.platform,
  };
}

// ─── Prex ──────────────────────────────────────────────────────────────

/**
 * "Estado de cuenta" de Prex: una tabla con Fecha, Descripción, Moneda
 * Origen, Importe Origen, Moneda, Importe, Estado. `Importe` es lo que
 * movió la cuenta (con signo) y `Importe Origen` lo pedido; difieren
 * cuando la comisión viene adentro. Solo cuentan las líneas confirmadas.
 */
export function parsePrex(rows: CellMatrix, headerRow: number): ParsedStatement | ParseFailure {
  const header = (rows[headerRow] ?? []).map(normalizeHeader);
  const col = (name: string) => header.indexOf(name);
  const cDate = col("fecha");
  const cDesc = col("descripcion");
  const cCur = col("moneda");
  const cAmt = col("importe");
  const cCurOrig = col("moneda origen");
  const cAmtOrig = col("importe origen");
  const cStatus = col("estado");
  if (cDate < 0 || cDesc < 0 || cAmt < 0) {
    return { error: "El archivo de Prex no trae las columnas Fecha, Descripción e Importe.", platform: "prex" };
  }

  const lines: StatementLine[] = [];
  const skipped: ParsedStatement["skipped"] = [];
  const warnings: string[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const row = i + 1;
    const isEmpty = r.every((c) => c == null || String(c).trim() === "");
    if (isEmpty) continue;

    const date = cellDate(r[cDate]);
    const amount = cellNumber(r[cAmt]);
    if (date == null && amount == null) continue; // pie de página, totales
    if (date == null || amount == null) {
      skipped.push({ row, reason: "sin fecha o sin importe legible" });
      continue;
    }
    const status = cStatus >= 0 ? cellText(r[cStatus]) || null : null;
    if (status && !/confirm|aprobad|acredit/i.test(status)) {
      skipped.push({ row, reason: `estado "${status}"` });
      continue;
    }
    if (amount === 0) {
      skipped.push({ row, reason: "importe cero" });
      continue;
    }
    const currency = (cCur >= 0 ? cellText(r[cCur]).toUpperCase() : "") || "UYU";
    const description = cellText(r[cDesc]);

    let grossAmount: number | null = null;
    if (cAmtOrig >= 0) {
      const orig = cellNumber(r[cAmtOrig]);
      const origCur = cCurOrig >= 0 ? cellText(r[cCurOrig]).toUpperCase() : currency;
      if (orig != null && origCur === currency && Math.abs(orig - amount) >= 0.005) {
        grossAmount = orig;
      }
    }

    lines.push({
      key: `L${row}`,
      row,
      date,
      amount,
      currency,
      description,
      reference: extractReference(description),
      grossAmount,
      status,
    });
  }

  if (lines.length === 0) {
    return { error: "El archivo de Prex no tiene movimientos confirmados.", platform: "prex" };
  }

  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row));
  const currencies = new Set(lines.map((l) => l.currency));
  if (currencies.size > 1) {
    warnings.push(
      `El extracto mezcla monedas (${[...currencies].join(", ")}): cada una se compara por separado.`
    );
  }

  return {
    platform: "prex",
    lines,
    skipped,
    from: lines[0].date,
    to: lines[lines.length - 1].date,
    warnings,
  };
}
