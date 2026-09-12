import { addMoney } from "./treasury-format";

/**
 * Libro Mayor de Caja — el formato que pide el MEC, calculado desde el
 * libro.
 *
 * El instructivo de libros sociales del MEC describe el Libro Mayor de
 * Caja con cinco columnas —Día, Concepto, Ingresos, Egresos, Saldo— y
 * cierres MENSUALES por mes civil. Esta Asamblea tiene varias cuentas y
 * dos monedas, así que el "mayor" sale por CUENTA Y MONEDA: una hoja por
 * cada combinación con movimientos en el mes, más una hoja resumen con
 * todas las cuentas. Es el mismo criterio "nunca sumar monedas distintas"
 * del resto de la Tesorería.
 *
 * Todo lo de acá es puro y sin React ni queries, para que lo compartan la
 * hoja imprimible (cliente), la pantalla de cierres (servidor) y el
 * snapshot que se congela al cerrar un mes.
 *
 * Meses CIVILES, no bahá'ís: es un documento legal y el mes que el MEC y
 * el contador reconocen es el del calendario. Los informes de la Fiesta
 * siguen por mes bahá'í y no se tocan.
 *
 * Sin nombres de contribuyentes: el concepto de un aporte es su número de
 * recibo y su rubro. El libro es un documento que puede pedir una
 * inspección; los nombres son confidenciales y quedan en la base.
 */

/** "2026-08-22" → "2026-08". */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Primer y último día del mes civil "2026-08". */
export function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map((p) => parseInt(p, 10));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${key}-01`, to: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map((p) => parseInt(p, 10));
  const d = new Date(Date.UTC(y, m, 1)); // m es 1-based: mes siguiente
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(key: string): string {
  const [y, m] = key.split("-").map((p) => parseInt(p, 10));
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Todos los meses civiles de `fromKey` a `toKey`, ambos incluidos. */
export function monthKeysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  while (k <= toKey && out.length < 240) {
    out.push(k);
    k = nextMonthKey(k);
  }
  return out;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-08" → "Agosto 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map((p) => parseInt(p, 10));
  const name = MONTHS_ES[m - 1] ?? key;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function isValidMonthKey(key: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(key)) return false;
  const m = parseInt(key.slice(5, 7), 10);
  return m >= 1 && m <= 12;
}

// ─── Entrada ─────────────────────────────────────────────────────

/** Lo mínimo que el Libro de Caja necesita de un movimiento. */
export type CashbookEntry = {
  id: string;
  entry_date: string;
  account_id: string;
  subcategory_id: string | null;
  currency: string;
  amount: number;
  description: string | null;
  receipt_number: number | null;
  contributions_count: number;
  transfer_group_id: string | null;
  is_opening_balance: boolean;
  voided_at: string | null;
  adjusts_entry_id: string | null;
};

export type CashbookNames = {
  accounts: Map<string, string>;
  subcategories: Map<string, string>;
};

// ─── Salida ──────────────────────────────────────────────────────

export type CashbookRow = {
  id: string;
  /** Día del mes, "07". */
  day: string;
  date: string;
  concept: string;
  receipt: number | null;
  income: number;
  expense: number;
  /** Saldo acumulado después de esta fila. */
  balance: number;
  /** Cambio de caja o compra de divisas: se marca, porque no es
   *  movimiento del Fondo aunque sí lo sea de la cuenta. */
  internal: boolean;
  /** Es un contra-asiento que revierte un movimiento de un mes cerrado. */
  adjustment: boolean;
};

export type CashbookSheet = {
  accountId: string;
  account: string;
  currency: string;
  opening: number;
  rows: CashbookRow[];
  income: number;
  expense: number;
  closing: number;
};

export type CashbookSummaryRow = {
  accountId: string;
  account: string;
  currency: string;
  opening: number;
  income: number;
  expense: number;
  closing: number;
  /** Cuántos movimientos tuvo la cuenta en el mes. */
  count: number;
};

export type Cashbook = {
  month: string;
  from: string;
  to: string;
  sheets: CashbookSheet[];
  summary: CashbookSummaryRow[];
  /** Movimientos del mes (sin anulados). */
  entriesCount: number;
  /** Cuántos movimientos anulados hay en el mes: se informan, no se suman. */
  voidedCount: number;
};

function conceptOf(e: CashbookEntry, names: CashbookNames): string {
  if (e.is_opening_balance) return "Saldo inicial del ejercicio";
  const rubro = (e.subcategory_id && names.subcategories.get(e.subcategory_id)) || "";
  const parts: string[] = [];
  if (e.transfer_group_id) parts.push("Transferencia interna");
  if (e.amount > 0 && e.receipt_number) parts.push(`Recibo N.º ${e.receipt_number}`);
  if (e.contributions_count > 1) parts.push(`${e.contributions_count} aportes`);
  const detail = e.description?.trim() || rubro;
  if (detail) parts.push(detail);
  if (rubro && detail !== rubro && !e.transfer_group_id) parts.push(rubro);
  return parts.join(" · ") || "Movimiento";
}

/**
 * Arma el Libro de Caja de un mes. `entries` tiene que traer TODO el
 * libro hasta el último día del mes (los saldos son acumulados: el saldo
 * anterior de agosto es todo lo que pasó antes del 1 de agosto).
 *
 * Los movimientos anulados no suman nada y no aparecen en las hojas; se
 * cuentan aparte para que la hoja resumen diga cuántos hubo.
 */
export function buildCashbook(
  entries: CashbookEntry[],
  month: string,
  names: CashbookNames
): Cashbook {
  const { from, to } = monthRange(month);
  const live = entries.filter((e) => !e.voided_at && e.entry_date <= to);
  const voidedCount = entries.filter(
    (e) => e.voided_at && e.entry_date >= from && e.entry_date <= to
  ).length;

  type Acc = { opening: number; inMonth: CashbookEntry[] };
  const byKey = new Map<string, Acc>();
  const keyOf = (e: CashbookEntry) => `${e.account_id}|${e.currency}`;

  for (const e of live) {
    const acc = byKey.get(keyOf(e)) ?? { opening: 0, inMonth: [] };
    if (e.entry_date < from) acc.opening = addMoney(acc.opening, e.amount);
    else acc.inMonth.push(e);
    byKey.set(keyOf(e), acc);
  }

  const sheets: CashbookSheet[] = [];
  const summary: CashbookSummaryRow[] = [];

  for (const [key, acc] of byKey) {
    const [accountId, currency] = key.split("|");
    const account = names.accounts.get(accountId) ?? "Cuenta";
    const sorted = [...acc.inMonth].sort(
      (a, b) =>
        a.entry_date.localeCompare(b.entry_date) ||
        (a.receipt_number ?? 0) - (b.receipt_number ?? 0) ||
        a.id.localeCompare(b.id)
    );

    let balance = acc.opening;
    let income = 0;
    let expense = 0;
    const rows: CashbookRow[] = sorted.map((e) => {
      balance = addMoney(balance, e.amount);
      if (e.amount > 0) income = addMoney(income, e.amount);
      else expense = addMoney(expense, -e.amount);
      return {
        id: e.id,
        day: e.entry_date.slice(8, 10),
        date: e.entry_date,
        concept: conceptOf(e, names),
        receipt: e.amount > 0 ? e.receipt_number : null,
        income: e.amount > 0 ? e.amount : 0,
        expense: e.amount < 0 ? -e.amount : 0,
        balance,
        internal: Boolean(e.transfer_group_id),
        adjustment: Boolean(e.adjusts_entry_id),
      };
    });

    // Una cuenta sin movimientos en el mes y con saldo cero no ocupa hoja.
    if (rows.length === 0 && Math.abs(acc.opening) < 0.005) continue;

    const sheet: CashbookSheet = {
      accountId,
      account,
      currency,
      opening: acc.opening,
      rows,
      income,
      expense,
      closing: balance,
    };
    sheets.push(sheet);
    summary.push({
      accountId,
      account,
      currency,
      opening: acc.opening,
      income,
      expense,
      closing: balance,
      count: rows.length,
    });
  }

  const order = (a: { account: string; currency: string }, b: typeof a) =>
    a.account.localeCompare(b.account, "es") || a.currency.localeCompare(b.currency);
  sheets.sort(order);
  summary.sort(order);

  return {
    month,
    from,
    to,
    sheets,
    summary,
    entriesCount: sheets.reduce((n, s) => n + s.rows.length, 0),
    voidedCount,
  };
}

/** Totales del resumen por moneda: nunca se suman monedas distintas. */
export function summaryTotals(summary: CashbookSummaryRow[]) {
  const map = new Map<string, CashbookSummaryRow>();
  for (const r of summary) {
    const t = map.get(r.currency) ?? {
      accountId: "",
      account: `Total ${r.currency}`,
      currency: r.currency,
      opening: 0,
      income: 0,
      expense: 0,
      closing: 0,
      count: 0,
    };
    t.opening = addMoney(t.opening, r.opening);
    t.income = addMoney(t.income, r.income);
    t.expense = addMoney(t.expense, r.expense);
    t.closing = addMoney(t.closing, r.closing);
    t.count += r.count;
    map.set(r.currency, t);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Lo que se congela en `treasury_closings.snapshot` al cerrar el mes: los
 * saldos por cuenta y moneda. Es evidencia, no fuente: el Libro de Caja se
 * vuelve a calcular desde los movimientos (que el trigger no deja tocar)
 * y se compara contra esto.
 */
export type ClosingSnapshotRow = {
  accountId: string;
  account: string;
  currency: string;
  opening: number;
  income: number;
  expense: number;
  closing: number;
};

export function closingSnapshot(book: Cashbook): ClosingSnapshotRow[] {
  return book.summary.map(({ accountId, account, currency, opening, income, expense, closing }) => ({
    accountId,
    account,
    currency,
    opening,
    income,
    expense,
    closing,
  }));
}

/** Filas del snapshot que ya no coinciden con lo que dice el libro. */
export function snapshotMismatches(
  book: Cashbook,
  snapshot: unknown
): Array<{ account: string; currency: string; was: number; now: number }> {
  if (!Array.isArray(snapshot)) return [];
  const out: Array<{ account: string; currency: string; was: number; now: number }> = [];
  const now = new Map(book.summary.map((r) => [`${r.accountId}|${r.currency}`, r.closing]));
  for (const raw of snapshot) {
    const r = raw as Partial<ClosingSnapshotRow>;
    if (!r.accountId || !r.currency || typeof r.closing !== "number") continue;
    const current = now.get(`${r.accountId}|${r.currency}`) ?? 0;
    if (Math.abs(current - r.closing) >= 0.005) {
      out.push({
        account: r.account ?? "Cuenta",
        currency: r.currency,
        was: r.closing,
        now: current,
      });
    }
  }
  return out;
}
