import type { StatementLine } from "./bank-statements";
import { addMoney } from "./treasury-format";

/**
 * Conciliación: el extracto de una cuenta contra el libro de esa cuenta.
 *
 * Es una función pura sobre datos ya cargados, como el motor de auditoría
 * (059) y el Libro de Caja (054): no consulta nada, no escribe nada. La
 * pantalla la llama con las líneas del extracto y los movimientos del
 * libro de la misma cuenta, y muestra lo que devuelve.
 *
 * Qué se compara y cómo:
 *
 *  · Una línea del extracto "cierra" con un movimiento del libro de la
 *    misma moneda, el mismo importe (con signo) y fecha a lo sumo
 *    `windowDays` días de distancia: el giro tiene una fecha y el tesorero
 *    lo registra otro día. Si hay varios candidatos gana el más cercano en
 *    fecha; cada movimiento cierra con UNA línea.
 *  · Prex mete la comisión adentro del importe (pedí 5.014, salieron
 *    5.058,26). El libro la tiene como dos asientos, la transferencia y el
 *    gasto por transferencia. Se acepta el par, y si falta el asiento de
 *    la comisión se dice cuánto falta.
 *  · Una línea puede cerrar contra DOS movimientos que suman su importe
 *    (dos aportes que entraron juntos), y una salida que la plataforma
 *    devolvió el mismo día (transferencia rechazada + devolución) se
 *    aparea consigo misma y no se le pide al libro.
 *  · Los movimientos anulados (054) y los saldos de apertura no cuentan.
 *
 * Lo que queda sin par, de cada lado, es el resultado útil: lo que está
 * en la plataforma y no en el libro (un giro sin registrar, una comisión)
 * y lo que está en el libro y no en la plataforma (cargado dos veces, en
 * la cuenta equivocada, con la fecha mal).
 */

export type ReconcileEntry = {
  id: string;
  entry_date: string;
  amount: number;
  currency: string;
  description: string | null;
  receipt_number: number | null;
  /** Nombre del rubro (subcategoría), ya resuelto. */
  rubro: string | null;
  transfer_group_id: string | null;
  is_opening_balance: boolean;
  voided_at: string | null;
};

export type MatchKind = "exacto" | "comision" | "suma";

export type ReconcileMatch = {
  line: StatementLine;
  entries: ReconcileEntry[];
  kind: MatchKind;
  /** Días entre la línea y el movimiento (el más lejano si son varios). */
  dayDiff: number;
  /** Solo en `comision`: cuánto falta registrar como gasto si el libro
   *  tiene la transferencia pero no la comisión. */
  missingFee: number | null;
};

export type ReversedPair = { out: StatementLine; back: StatementLine };

export type CurrencyTotals = {
  currency: string;
  /** Suma de las líneas del extracto en el período. */
  statementNet: number;
  /** Suma de los movimientos del libro de esa cuenta en el período. */
  ledgerNet: number;
  diff: number;
  /** Saldo del libro de esa cuenta al último día del extracto. */
  ledgerBalance: number;
  /** El saldo que declara la plataforma, si el archivo lo trae (BROU). */
  statementBalance: number | null;
  /** statementBalance - ledgerBalance, o null si la plataforma no lo dice. */
  balanceDiff: number | null;
};

export type ReconcileResult = {
  from: string;
  to: string;
  windowDays: number;
  matched: ReconcileMatch[];
  reversed: ReversedPair[];
  unmatchedLines: StatementLine[];
  unmatchedEntries: ReconcileEntry[];
  totals: CurrencyTotals[];
  /** Todo cerró: sin líneas ni movimientos sueltos y netos iguales. */
  clean: boolean;
};

export const DEFAULT_WINDOW_DAYS = 3;

const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Días entre dos fechas ISO (b - a), sin pasar por husos horarios. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const REVERSAL_RE = /devoluci|revers|anulad|rechaz|reintegro/i;

/**
 * Totales por moneda, nunca sumadas entre sí: neto del extracto contra
 * neto del libro en [from, to], saldo del libro a `to` (acumulado, con
 * apertura) y, si la plataforma lo declara, su saldo y la diferencia.
 * Aparte de `reconcile()` porque la pantalla persistida lo necesita sin
 * volver a cruzar nada.
 */
export function reconcileTotals(
  lines: StatementLine[],
  allEntries: ReconcileEntry[],
  opts: { from: string; to: string; statementBalance?: { amount: number; currency: string } | null }
): CurrencyTotals[] {
  const { from, to } = opts;
  const live = allEntries.filter((e) => !e.voided_at);
  const currencies = new Set<string>([
    ...lines.map((l) => l.currency),
    ...live.filter((e) => e.entry_date >= from && e.entry_date <= to).map((e) => e.currency),
  ]);
  return [...currencies].sort().map((currency) => {
    const statementNet = lines
      .filter((l) => l.currency === currency)
      .reduce((s, l) => addMoney(s, l.amount), 0);
    const ledgerNet = live
      .filter(
        (e) =>
          e.currency === currency &&
          !e.is_opening_balance &&
          e.entry_date >= from &&
          e.entry_date <= to
      )
      .reduce((s, e) => addMoney(s, e.amount), 0);
    const ledgerBalance = live
      .filter((e) => e.currency === currency && e.entry_date <= to)
      .reduce((s, e) => addMoney(s, e.amount), 0);
    const sb = opts.statementBalance;
    const statementBalance = sb && sb.currency === currency ? sb.amount : null;
    return {
      currency,
      statementNet,
      ledgerNet,
      diff: addMoney(statementNet, -ledgerNet),
      ledgerBalance,
      statementBalance,
      balanceDiff: statementBalance == null ? null : addMoney(statementBalance, -ledgerBalance),
    };
  });
}

export function reconcile(
  lines: StatementLine[],
  allEntries: ReconcileEntry[],
  opts: {
    from: string;
    to: string;
    windowDays?: number;
    /** El saldo que declara la plataforma al cierre del extracto, si lo
     *  trae: se compara con el saldo del libro de esa moneda. */
    statementBalance?: { amount: number; currency: string } | null;
  }
): ReconcileResult {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const { from, to } = opts;
  const lo = shiftDate(from, -windowDays);
  const hi = shiftDate(to, windowDays);

  // Lo que puede cerrar con una línea: vivo, no apertura, cerca del rango.
  const live = allEntries.filter((e) => !e.voided_at);
  const candidates = live
    .filter((e) => !e.is_opening_balance && e.entry_date >= lo && e.entry_date <= hi)
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0));

  const usedEntries = new Set<string>();
  const usedLines = new Set<string>();
  const matched: ReconcileMatch[] = [];
  const reversed: ReversedPair[] = [];

  const ordered = [...lines].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row
  );

  // 0. Salidas que la plataforma devolvió: se aparean entre sí.
  for (const back of ordered) {
    if (usedLines.has(back.key) || back.amount <= 0 || !REVERSAL_RE.test(back.description)) continue;
    const out = ordered.find(
      (l) =>
        !usedLines.has(l.key) &&
        l.key !== back.key &&
        l.currency === back.currency &&
        sameMoney(l.amount, -back.amount) &&
        Math.abs(daysBetween(l.date, back.date)) <= windowDays
    );
    if (out) {
      usedLines.add(out.key);
      usedLines.add(back.key);
      reversed.push({ out, back });
    }
  }

  const free = (l: StatementLine) =>
    candidates.filter((e) => !usedEntries.has(e.id) && e.currency === l.currency);

  const closest = (l: StatementLine, pool: ReconcileEntry[], amount: number) => {
    let best: ReconcileEntry | null = null;
    let bestDiff = Infinity;
    for (const e of pool) {
      if (!sameMoney(e.amount, amount)) continue;
      const d = Math.abs(daysBetween(l.date, e.entry_date));
      if (d > windowDays) continue;
      if (d < bestDiff) {
        best = e;
        bestDiff = d;
      }
    }
    return best ? { entry: best, dayDiff: bestDiff } : null;
  };

  // 1. Exactos: mismo importe, misma moneda, fecha cerca.
  for (const l of ordered) {
    if (usedLines.has(l.key)) continue;
    const hit = closest(l, free(l), l.amount);
    if (hit) {
      usedLines.add(l.key);
      usedEntries.add(hit.entry.id);
      matched.push({ line: l, entries: [hit.entry], kind: "exacto", dayDiff: hit.dayDiff, missingFee: null });
    }
  }

  // 2. Comisión adentro (Prex): el libro tiene lo pedido, y quizá el gasto.
  for (const l of ordered) {
    if (usedLines.has(l.key) || l.grossAmount == null) continue;
    const hit = closest(l, free(l), l.grossAmount);
    if (!hit) continue;
    usedLines.add(l.key);
    usedEntries.add(hit.entry.id);
    const fee = addMoney(l.amount, -l.grossAmount); // negativo en una salida
    const feeHit = closest(l, free(l), fee);
    const entries = [hit.entry];
    if (feeHit) {
      usedEntries.add(feeHit.entry.id);
      entries.push(feeHit.entry);
    }
    matched.push({
      line: l,
      entries,
      kind: "comision",
      dayDiff: Math.max(hit.dayDiff, feeHit?.dayDiff ?? 0),
      missingFee: feeHit ? null : Math.abs(fee),
    });
  }

  // 3. Dos movimientos que suman la línea.
  for (const l of ordered) {
    if (usedLines.has(l.key)) continue;
    const pool = free(l).filter((e) => Math.abs(daysBetween(l.date, e.entry_date)) <= windowDays);
    let found: [ReconcileEntry, ReconcileEntry] | null = null;
    outer: for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (sameMoney(addMoney(pool[i].amount, pool[j].amount), l.amount)) {
          found = [pool[i], pool[j]];
          break outer;
        }
      }
    }
    if (found) {
      usedLines.add(l.key);
      found.forEach((e) => usedEntries.add(e.id));
      matched.push({
        line: l,
        entries: found,
        kind: "suma",
        dayDiff: Math.max(...found.map((e) => Math.abs(daysBetween(l.date, e.entry_date)))),
        missingFee: null,
      });
    }
  }

  const unmatchedLines = ordered.filter((l) => !usedLines.has(l.key));
  // Del libro solo se reclama lo que cae DENTRO del extracto: un
  // movimiento tres días antes del primer renglón puede estar en el
  // extracto anterior.
  const unmatchedEntries = candidates.filter(
    (e) => !usedEntries.has(e.id) && e.entry_date >= from && e.entry_date <= to
  );

  const totals = reconcileTotals(lines, allEntries, {
    from,
    to,
    statementBalance: opts.statementBalance,
  });

  const clean =
    unmatchedLines.length === 0 &&
    unmatchedEntries.length === 0 &&
    matched.every((m) => m.missingFee == null) &&
    totals.every((t) => sameMoney(t.diff, 0) && (t.balanceDiff == null || sameMoney(t.balanceDiff, 0)));

  return { from, to, windowDays, matched, reversed, unmatchedLines, unmatchedEntries, totals, clean };
}
