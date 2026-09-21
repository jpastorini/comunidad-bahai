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
  /** BROU: el "Asunto", lo que escribió quien giró (nombre y concepto).
   *  Es lo más útil para reconocer un aporte sin registrar. */
  memo: string | null;
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
  /** El saldo que declara la plataforma, si el archivo lo trae (el BROU
   *  lo pone arriba; Prex no lo trae). En la moneda del extracto. */
  closingBalance: { amount: number; currency: string; asOf: string } | null;
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
  if (detected.platform === "brou") return parseBrou(rows, detected.headerRow);
  return {
    error: `Es un archivo de ${PLATFORM_LABELS[detected.platform]}. Por ahora la conciliación lee Prex y BROU; ${PLATFORM_LABELS[detected.platform]} viene en el próximo paso.`,
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
      memo: null,
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
    closingBalance: null,
    warnings,
  };
}

// ─── BROU ──────────────────────────────────────────────────────────────

/**
 * La pantalla "Saldos y Movimientos" de eBROU guardada como Excel. Arriba
 * el bloque de la cuenta ("Fecha: 19/09/2026 22:07", el nombre, "Saldo
 * disponible\n$ 578.239,81", "Moneda\n$"), y más abajo la tabla de los
 * últimos movimientos: Fecha (serial de Excel), Descripción, Número de
 * documento, Asunto, Dependencia, Débito, Crédito. Una sola moneda por
 * cuenta y sin saldo por línea, pero el saldo de arriba es un dato real:
 * se devuelve en `closingBalance` para cotejarlo con el libro.
 *
 * Trae solo los últimos ~20 movimientos, así que la conciliación cubre
 * lo que el archivo cubre; si eBROU exporta por rango de fechas con otra
 * disposición, se agrega acá como segunda variante.
 */
export function parseBrou(rows: CellMatrix, headerRow: number): ParsedStatement | ParseFailure {
  const header = (rows[headerRow] ?? []).map(normalizeHeader);
  const col = (name: string) => header.indexOf(name);
  const cDate = col("fecha");
  const cDesc = col("descripcion");
  const cDoc = header.findIndex((h) => h.startsWith("numero de documento") || h === "documento");
  const cMemo = col("asunto");
  const cDebit = col("debito");
  const cCredit = col("credito");
  if (cDate < 0 || cDesc < 0 || cDebit < 0 || cCredit < 0) {
    return { error: "El archivo del BROU no trae las columnas Fecha, Descripción, Débito y Crédito.", platform: "brou" };
  }

  const { currency, balance, asOf, accountLabel } = brouHeaderBlock(rows, headerRow);
  const lines: StatementLine[] = [];
  const skipped: ParsedStatement["skipped"] = [];
  const warnings: string[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const row = i + 1;
    if (r.every((c) => c == null || String(c).trim() === "")) continue;

    const date = brouDate(r[cDate]);
    const debit = cellNumber(r[cDebit]);
    const credit = cellNumber(r[cCredit]);
    if (date == null && debit == null && credit == null) continue; // pie, leyenda del banco
    if (date == null) {
      skipped.push({ row, reason: "sin fecha legible" });
      continue;
    }
    // Débito y Crédito vienen en dos columnas, siempre positivas.
    const amount = round2((credit ?? 0) - Math.abs(debit ?? 0));
    if (amount === 0) {
      skipped.push({ row, reason: "sin importe" });
      continue;
    }
    const description = cellText(r[cDesc]);
    const memo = cMemo >= 0 ? cellText(r[cMemo]) || null : null;
    const doc = cDoc >= 0 ? cellText(r[cDoc]).replace(/\D/g, "") : "";

    lines.push({
      key: `L${row}`,
      row,
      date,
      amount,
      currency,
      description,
      reference: doc.length >= 4 ? doc : extractReference(`${description} ${memo ?? ""}`),
      grossAmount: null,
      status: null,
      memo,
    });
  }

  if (lines.length === 0) {
    return { error: "El archivo del BROU no tiene movimientos.", platform: "brou" };
  }

  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row));
  const to = lines[lines.length - 1].date;
  if (accountLabel) warnings.push(`Cuenta según el archivo: ${accountLabel}.`);
  warnings.push(
    "eBROU exporta solo los últimos movimientos: el período conciliado es el que cubre el archivo, no un mes entero."
  );

  return {
    platform: "brou",
    lines,
    skipped,
    from: lines[0].date,
    to,
    closingBalance: balance != null ? { amount: balance, currency, asOf: asOf ?? to } : null,
    warnings,
  };
}

/** Las fechas del BROU vienen como serial de Excel; si alguien las guardó
 *  como texto, WPS las escribe m/d/yy (locale de quien exportó). Se prueba
 *  d/m primero y, si el mes no cierra, m/d. */
function brouDate(c: Cell): string | null {
  const iso = cellDate(c);
  if (iso) return iso;
  const m = String(c ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
  return isoDate(y, parseInt(m[1], 10), parseInt(m[2], 10));
}

/**
 * El bloque de arriba del archivo del BROU: moneda, saldo disponible,
 * fecha de la consulta y nombre de la cuenta. Cada dato viene en una celda
 * con el rótulo y el valor separados por un salto de línea
 * ("Saldo disponible\n$ 578.239,81"). Todo es opcional: si el banco cambia
 * el bloque, el extracto se lee igual, sin saldo.
 */
function brouHeaderBlock(rows: CellMatrix, headerRow: number) {
  let currency = "UYU";
  let balance: number | null = null;
  let asOf: string | null = null;
  let accountLabel: string | null = null;
  let sawCurrency = false;

  for (let i = 0; i < headerRow; i++) {
    for (const c of rows[i] ?? []) {
      const text = String(c ?? "").trim();
      if (!text) continue;
      const [label, ...rest] = text.split(/\r?\n/);
      const value = rest.join(" ").trim();
      const key = normalizeHeader(label);

      if (key === "moneda" && !sawCurrency) {
        sawCurrency = true;
        if (/u\$s|usd|d[oó]lar/i.test(value)) currency = "USD";
      } else if (key === "saldo disponible" && balance == null) {
        balance = cellNumber(value.replace(/^U\$S|^\$/i, ""));
      } else if (key.startsWith("fecha:") || key === "fecha") {
        const m = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (m) asOf = cellDate(m[1]);
      } else if (!accountLabel && /^\d+\s+\S/.test(text) && rest.length === 0 && i < headerRow) {
        // "3 AEN Pesos UY": el número de orden de la cuenta y su nombre.
        accountLabel = text;
      }
    }
  }
  if (!sawCurrency && accountLabel && /d[oó]lar|usd/i.test(accountLabel)) currency = "USD";
  return { currency, balance, asOf, accountLabel };
}
