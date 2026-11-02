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
 *    fecha; fuera de un grupo, cada movimiento cierra con UNA línea.
 *  · Prex mete la comisión adentro del importe (pedí 5.014, salieron
 *    5.058,26). El libro la tiene como dos asientos, la transferencia y el
 *    gasto por transferencia. Se acepta el par, y si falta el asiento de
 *    la comisión se dice cuánto falta.
 *  · Una línea puede cerrar contra DOS movimientos que suman su importe
 *    (dos aportes que entraron juntos), y una salida que la plataforma
 *    devolvió el mismo día (transferencia rechazada + devolución) se
 *    aparea consigo misma y no se le pide al libro.
 *  · Varios cobros del mismo día (Mercado Pago, Point) pueden cerrar como
 *    GRUPO contra los movimientos del libro de ese día que suman lo mismo:
 *    la canasta de la Fiesta como un aporte y la comisión del día como un
 *    gasto (089).
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

export type MatchKind = "exacto" | "comision" | "suma" | "grupo";

export type ReconcileMatch = {
  /** La primera de `lines`. */
  line: StatementLine;
  /** Todas las líneas del par: una sola, salvo en `grupo`. */
  lines: StatementLine[];
  entries: ReconcileEntry[];
  kind: MatchKind;
  /** Días entre la línea y el movimiento (el más lejano si son varios). */
  dayDiff: number;
  /** Solo en `comision`: cuánto falta registrar como gasto si el libro
   *  tiene la transferencia pero no la comisión. */
  missingFee: number | null;
  /** La diferencia que el par deja a la vista y que ya está explicada: la
   *  comisión que Prex cobró y no informa (`isHiddenFeeLine`). */
  acceptedDiff: number | null;
};

export type ReversedPair = { out: StatementLine; back: StatementLine };

export type CurrencyTotals = {
  currency: string;
  /** Suma de las líneas del extracto en el período. */
  statementNet: number;
  /** Lo que el libro tiene de esas líneas: los movimientos vinculados a
   *  ellas, sea cual sea su fecha, más los sueltos con fecha en el período
   *  (los vinculados a líneas de OTRO período no). */
  ledgerNet: number;
  diff: number;
  /** La parte de `diff` que ya está explicada: diferencias aceptadas de un
   *  grupo y movimientos que no pasan por el banco (091). */
  explained: number;
  /** diff − explained: lo que de verdad falta resolver. */
  unexplained: number;
  /** Movimientos vinculados a líneas del período con fecha fuera de él (una
   *  corrección cargada hoy de un mes cerrado, un aporte registrado tarde). */
  outsideLinked: { count: number; amount: number };
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
 * La comisión oculta de Prex. Desde octubre de 2026 el export de Prex dice,
 * en una transferencia a otro banco ("TRANSFERENCIA TRN"), lo PEDIDO y no lo
 * debitado: la línea dice −2.000 y salieron 2.044,26. El libro tiene la
 * transferencia y el gasto de la comisión, así que el par queda con la
 * comisión de diferencia sin que falte nada. Es un patrón exacto y se acepta
 * solo: la línea es una salida "transferencia trn" sin importe pedido (el
 * export viejo sí lo traía, y ahí la comisión cierra por `grossAmount`), y la
 * diferencia es UN gasto de comisión del grupo. Cualquier otra diferencia la
 * acepta una persona (093).
 */
export const HIDDEN_FEE_REASON = "Prex no informa la comisión de las transferencias a otro banco.";
const HIDDEN_FEE_LINE_RE = /^transferencia trn\b/i;
const FEE_RE = /comisi|gastos? por transfer/i;
/** Una comisión por giro no pasa de esto; más grande ya no es "la comisión". */
const MAX_HIDDEN_FEE = 150;

export function isHiddenFeeLine(l: { amount: number; grossAmount: number | null; description: string }): boolean {
  return l.amount < 0 && l.grossAmount == null && HIDDEN_FEE_LINE_RE.test(l.description.trim());
}

export function isFeeEntry(e: Pick<ReconcileEntry, "amount" | "rubro" | "description">): boolean {
  return e.amount < 0 && -e.amount <= MAX_HIDDEN_FEE && FEE_RE.test(`${e.rubro ?? ""} ${e.description ?? ""}`);
}

/** La diferencia de un par (líneas − movimientos) es la comisión oculta de
 *  Prex: una sola línea TRN y un gasto de comisión del grupo por ese monto. */
export function hiddenFeeExplains(
  lines: Array<{ amount: number; grossAmount: number | null; description: string }>,
  entries: Array<Pick<ReconcileEntry, "amount" | "rubro" | "description">>,
  diff: number
): boolean {
  return (
    lines.length === 1 &&
    isHiddenFeeLine(lines[0]) &&
    diff > 0 &&
    entries.some((e) => isFeeEntry(e) && sameMoney(-e.amount, diff))
  );
}

/** Hasta cuántos movimientos se combinan para cerrar un grupo: 2^16
 *  combinaciones es nada; más que eso un día no tiene. */
const MAX_GROUP_POOL = 16;

/**
 * La combinación de movimientos que suma `target`: la de menos
 * movimientos y, a igual cantidad, la más cercana a `date`. null si no
 * hay o si el pozo es demasiado grande para probar todas.
 */
export function subsetSumming(
  pool: ReconcileEntry[],
  target: number,
  date?: string
): ReconcileEntry[] | null {
  if (pool.length === 0 || pool.length > MAX_GROUP_POOL) return null;
  const cents = pool.map((e) => Math.round(e.amount * 100));
  const goal = Math.round(target * 100);
  let best: { mask: number; size: number; spread: number } | null = null;
  for (let mask = 1; mask < 1 << pool.length; mask++) {
    let sum = 0;
    let size = 0;
    let spread = 0;
    for (let i = 0; i < pool.length; i++) {
      if (mask & (1 << i)) {
        sum += cents[i];
        size++;
        if (date) spread += Math.abs(daysBetween(date, pool[i].entry_date));
      }
    }
    if (sum !== goal) continue;
    if (!best || size < best.size || (size === best.size && spread < best.spread)) {
      best = { mask, size, spread };
    }
  }
  if (!best) return null;
  const chosen = best.mask;
  return pool.filter((_, i) => chosen & (1 << i));
}

/**
 * Totales por moneda, nunca sumadas entre sí. El lado del libro son los
 * movimientos que corresponden a ESAS líneas, no los que tienen fecha en el
 * período: un movimiento vinculado a una línea del período cuenta aunque se
 * haya cargado después (la corrección de un mes cerrado va con fecha de hoy),
 * y uno con fecha en el período vinculado a una línea de otro extracto no
 * cuenta. Lo suelto entra por fecha, que es lo único que se sabe de él.
 */
export function reconcileTotals(
  lines: StatementLine[],
  allEntries: ReconcileEntry[],
  opts: {
    from: string;
    to: string;
    statementBalance?: { amount: number; currency: string } | null;
    /** Movimientos vinculados a `lines`. */
    linked?: Set<string>;
    /** Movimientos vinculados a líneas que NO están en `lines`. */
    linkedElsewhere?: Set<string>;
    /** Los "no pasa por el banco" (091): su importe está explicado. */
    offBank?: Set<string>;
    /** Las diferencias aceptadas de los grupos, por moneda. */
    accepted?: Map<string, number>;
  }
): CurrencyTotals[] {
  const { from, to } = opts;
  const linked = opts.linked ?? new Set<string>();
  const elsewhere = opts.linkedElsewhere ?? new Set<string>();
  const offBank = opts.offBank ?? new Set<string>();
  const live = allEntries.filter((e) => !e.voided_at);
  const inPeriod = (e: ReconcileEntry) => e.entry_date >= from && e.entry_date <= to;
  const counted = live.filter(
    (e) => !e.is_opening_balance && (linked.has(e.id) || (inPeriod(e) && !elsewhere.has(e.id)))
  );
  const currencies = new Set<string>([...lines.map((l) => l.currency), ...counted.map((e) => e.currency)]);
  return [...currencies].sort().map((currency) => {
    const statementNet = lines
      .filter((l) => l.currency === currency)
      .reduce((s, l) => addMoney(s, l.amount), 0);
    const mine = counted.filter((e) => e.currency === currency);
    const ledgerNet = mine.reduce((s, e) => addMoney(s, e.amount), 0);
    const outside = mine.filter((e) => linked.has(e.id) && !inPeriod(e));
    const offBankNet = mine
      .filter((e) => offBank.has(e.id) && !linked.has(e.id))
      .reduce((s, e) => addMoney(s, e.amount), 0);
    const diff = addMoney(statementNet, -ledgerNet);
    const explained = addMoney(opts.accepted?.get(currency) ?? 0, -offBankNet);
    const ledgerBalance = live
      .filter((e) => e.currency === currency && e.entry_date <= to)
      .reduce((s, e) => addMoney(s, e.amount), 0);
    const sb = opts.statementBalance;
    const statementBalance = sb && sb.currency === currency ? sb.amount : null;
    return {
      currency,
      statementNet,
      ledgerNet,
      diff,
      explained,
      unexplained: addMoney(diff, -explained),
      outsideLinked: { count: outside.length, amount: outside.reduce((s, e) => addMoney(s, e.amount), 0) },
      ledgerBalance,
      statementBalance,
      balanceDiff: statementBalance == null ? null : addMoney(statementBalance, -ledgerBalance),
    };
  });
}

/** El gasto de comisión libre más cercano a `date`, dentro de la ventana. */
export function closestFeeEntry(
  date: string,
  pool: ReconcileEntry[],
  windowDays: number = DEFAULT_WINDOW_DAYS
): { entry: ReconcileEntry; dayDiff: number } | null {
  let best: { entry: ReconcileEntry; dayDiff: number } | null = null;
  for (const e of pool) {
    if (e.voided_at || e.is_opening_balance || !isFeeEntry(e)) continue;
    const d = Math.abs(daysBetween(date, e.entry_date));
    if (d <= windowDays && (!best || d < best.dayDiff)) best = { entry: e, dayDiff: d };
  }
  return best;
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
      matched.push({
        line: l,
        lines: [l],
        entries: [hit.entry],
        kind: "exacto",
        dayDiff: hit.dayDiff,
        missingFee: null,
        acceptedDiff: null,
      });
    }
  }

  // 1b. La comisión oculta de Prex: la línea TRN cerró contra la
  // transferencia y el libro tiene además la comisión de ese giro. Se suma
  // al par y su diferencia queda aceptada (ver `isHiddenFeeLine`).
  for (const m of matched) {
    if (m.kind !== "exacto" || !isHiddenFeeLine(m.line)) continue;
    const fee = closestFeeEntry(m.line.date, free(m.line), windowDays);
    if (!fee) continue;
    usedEntries.add(fee.entry.id);
    m.entries.push(fee.entry);
    m.kind = "comision";
    m.dayDiff = Math.max(m.dayDiff, fee.dayDiff);
    m.acceptedDiff = -fee.entry.amount;
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
      lines: [l],
      entries,
      kind: "comision",
      dayDiff: Math.max(hit.dayDiff, feeHit?.dayDiff ?? 0),
      missingFee: feeHit ? null : Math.abs(fee),
      acceptedDiff: null,
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
        lines: [l],
        entries: found,
        kind: "suma",
        dayDiff: Math.max(...found.map((e) => Math.abs(daysBetween(l.date, e.entry_date)))),
        missingFee: null,
        acceptedDiff: null,
      });
    }
  }

  // 4. El grupo del día (Mercado Pago, Point): varios cobros del mismo día
  // contra los movimientos que el libro tiene por ese día — la canasta de
  // la Fiesta como UN aporte y una sola comisión del día. Entran las
  // líneas que quedaron sueltas y las que cerraron por comisión sin
  // encontrar el gasto (ese par se deshace y se rearma como grupo).
  const days = [...new Set(ordered.map((l) => `${l.date}|${l.currency}`))];
  for (const day of days) {
    const [date, currency] = day.split("|");
    const loose = matched.filter(
      (m) => m.kind === "comision" && m.missingFee != null && m.line.date === date && m.line.currency === currency
    );
    const group = ordered.filter(
      (l) =>
        l.date === date &&
        l.currency === currency &&
        (!usedLines.has(l.key) || loose.some((m) => m.line.key === l.key))
    );
    if (group.length < 2) continue;
    const target = group.reduce((s, l) => addMoney(s, l.amount), 0);
    const released = new Set(loose.flatMap((m) => m.entries.map((e) => e.id)));
    const pool = candidates.filter(
      (e) => e.currency === currency && (!usedEntries.has(e.id) || released.has(e.id))
    );
    const found =
      subsetSumming(pool.filter((e) => e.entry_date === date), target) ??
      subsetSumming(
        pool.filter((e) => Math.abs(daysBetween(date, e.entry_date)) <= windowDays),
        target,
        date
      );
    if (!found) continue;
    for (const m of loose) matched.splice(matched.indexOf(m), 1);
    released.forEach((id) => usedEntries.delete(id));
    group.forEach((l) => usedLines.add(l.key));
    found.forEach((e) => usedEntries.add(e.id));
    matched.push({
      line: group[0],
      lines: group,
      entries: found,
      kind: "grupo",
      dayDiff: Math.max(...found.map((e) => Math.abs(daysBetween(date, e.entry_date)))),
      missingFee: null,
      acceptedDiff: null,
    });
  }

  const unmatchedLines = ordered.filter((l) => !usedLines.has(l.key));
  // Del libro solo se reclama lo que cae DENTRO del extracto: un
  // movimiento tres días antes del primer renglón puede estar en el
  // extracto anterior.
  const unmatchedEntries = candidates.filter(
    (e) => !usedEntries.has(e.id) && e.entry_date >= from && e.entry_date <= to
  );

  const accepted = new Map<string, number>();
  for (const m of matched) {
    if (m.acceptedDiff == null) continue;
    accepted.set(m.line.currency, addMoney(accepted.get(m.line.currency) ?? 0, m.acceptedDiff));
  }
  const totals = reconcileTotals(lines, allEntries, {
    from,
    to,
    statementBalance: opts.statementBalance,
    linked: usedEntries,
    accepted,
  });

  const clean =
    unmatchedLines.length === 0 &&
    unmatchedEntries.length === 0 &&
    matched.every((m) => m.missingFee == null) &&
    totals.every((t) => sameMoney(t.unexplained, 0) && (t.balanceDiff == null || sameMoney(t.balanceDiff, 0)));

  return { from, to, windowDays, matched, reversed, unmatchedLines, unmatchedEntries, totals, clean };
}
