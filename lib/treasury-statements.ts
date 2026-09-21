import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatementLine, StatementPlatform } from "./bank-statements";
import { addMoney } from "./treasury-format";
import {
  reconcileTotals,
  shiftDate,
  type CurrencyTotals,
  type MatchKind,
  type ReconcileEntry,
} from "./treasury-reconcile";

/**
 * Lo que la conciliación persiste (061): importaciones, líneas del
 * extracto y pares línea ↔ movimiento. Lecturas para la pantalla y para
 * Cierres, más el cálculo puro de "conciliado", que NO se guarda: se
 * deriva, como "Aprobado" en los informes.
 *
 * Server-only (hace queries). Los tipos se importan desde el cliente con
 * `import type`.
 */

export const STATEMENTS_BUCKET = "extractos";

export type StatementImport = {
  id: string;
  account_id: string;
  platform: StatementPlatform;
  file_name: string;
  storage_path: string | null;
  period_from: string;
  period_to: string;
  currency: string;
  closing_balance: number | null;
  closing_balance_as_of: string | null;
  lines_count: number;
  new_lines_count: number;
  imported_by: string | null;
  created_at: string;
};

export type StoredLine = {
  id: string;
  account_id: string;
  import_id: string;
  platform: StatementPlatform;
  fingerprint: string;
  line_date: string;
  amount: number;
  currency: string;
  description: string;
  memo: string | null;
  reference: string | null;
  gross_amount: number | null;
  dismissed_at: string | null;
  dismissed_by: string | null;
  dismiss_reason: string | null;
  dismissed_auto: boolean;
};

export type StoredMatchKind = MatchKind | "manual";

export type StoredMatch = {
  id: string;
  line_id: string;
  entry_id: string;
  kind: StoredMatchKind;
  matched_by: "motor" | "tesorero";
  created_at: string;
};

/** Una línea con sus pares resueltos. `diff` es lo que la línea tiene de
 *  más respecto de la suma de sus movimientos: distinto de cero cuando el
 *  libro tiene la transferencia y no la comisión que Prex cobró adentro. */
export type LineView = {
  line: StoredLine;
  entries: ReconcileEntry[];
  kinds: StoredMatchKind[];
  manual: boolean;
  diff: number;
};

export type AccountReconciliation = {
  imports: StatementImport[];
  /** Rango que cubren las líneas importadas de la cuenta. */
  coverage: { from: string; to: string } | null;
  totals: CurrencyTotals[];
  /** El saldo declarado por la importación más reciente que lo traiga. */
  latestBalance: { amount: number; currency: string; asOf: string } | null;
  pending: StoredLine[];
  matched: LineView[];
  dismissed: StoredLine[];
  /** Movimientos del libro de la cuenta, dentro de la cobertura, vivos,
   *  sin par: lo que la plataforma no muestra. */
  pendingEntries: ReconcileEntry[];
  /** Movimientos sin par cerca de la cobertura, para vincular a mano. */
  candidates: ReconcileEntry[];
};

/** Códigos de "todavía no corrió la 061". */
export function isStatementsSchemaMissing(error: { code?: string } | null | undefined): boolean {
  return !!error && (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205");
}

/** La fila guardada como línea del motor (`key` = id; la fila del archivo
 *  ya no importa). */
export function toStatementLine(l: StoredLine): StatementLine {
  return {
    key: l.id,
    row: 0,
    date: l.line_date,
    amount: Number(l.amount),
    currency: l.currency,
    description: l.description,
    reference: l.reference,
    grossAmount: l.gross_amount == null ? null : Number(l.gross_amount),
    status: null,
    memo: l.memo,
  };
}

// ─── Lecturas ──────────────────────────────────────────────────────────

const IMPORT_FIELDS =
  "id, account_id, platform, file_name, storage_path, period_from, period_to, currency, closing_balance, closing_balance_as_of, lines_count, new_lines_count, imported_by, created_at";

const LINE_FIELDS =
  "id, account_id, import_id, platform, fingerprint, line_date, amount, currency, description, memo, reference, gross_amount, dismissed_at, dismissed_by, dismiss_reason, dismissed_auto";

export async function getImports(
  supabase: SupabaseClient,
  accountId?: string
): Promise<{ rows: StatementImport[]; missing: boolean }> {
  let q = supabase
    .from("treasury_statement_imports")
    .select(IMPORT_FIELDS)
    .order("created_at", { ascending: false });
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) {
    if (!isStatementsSchemaMissing(error)) console.error("[getImports]", error);
    return { rows: [], missing: isStatementsSchemaMissing(error) };
  }
  return {
    rows: ((data ?? []) as StatementImport[]).map((i) => ({
      ...i,
      closing_balance: i.closing_balance == null ? null : Number(i.closing_balance),
    })),
    missing: false,
  };
}

export async function getStoredLines(
  supabase: SupabaseClient,
  accountId?: string
): Promise<StoredLine[]> {
  let q = supabase
    .from("treasury_statement_lines")
    .select(LINE_FIELDS)
    .order("line_date", { ascending: true });
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) {
    if (!isStatementsSchemaMissing(error)) console.error("[getStoredLines]", error);
    return [];
  }
  return ((data ?? []) as StoredLine[]).map((l) => ({
    ...l,
    amount: Number(l.amount),
    gross_amount: l.gross_amount == null ? null : Number(l.gross_amount),
  }));
}

export async function getMatches(
  supabase: SupabaseClient,
  lineIds?: string[]
): Promise<StoredMatch[]> {
  let q = supabase
    .from("treasury_statement_matches")
    .select("id, line_id, entry_id, kind, matched_by, created_at");
  if (lineIds) {
    if (lineIds.length === 0) return [];
    q = q.in("line_id", lineIds);
  }
  const { data, error } = await q;
  if (error) {
    if (!isStatementsSchemaMissing(error)) console.error("[getMatches]", error);
    return [];
  }
  return (data ?? []) as StoredMatch[];
}

/** Los movimientos que ya cerraron contra el banco (para la marca del
 *  libro). Vacío si la 061 no corrió. */
export async function getReconciledEntryIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("treasury_statement_matches").select("entry_id");
  if (error) return new Set();
  return new Set(((data ?? []) as Array<{ entry_id: string }>).map((r) => r.entry_id));
}

export async function getRubroNames(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from("treasury_subcategories").select("id, name");
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
}

/**
 * Los movimientos del libro de una cuenta hasta `upTo`, con el rubro
 * resuelto. Antes de la 054 no existe `voided_at`: se reintenta sin ella.
 */
export async function getAccountEntries(
  supabase: SupabaseClient,
  accountId: string,
  upTo: string,
  rubroOf: Map<string, string>
): Promise<{ entries: ReconcileEntry[]; error: string | null }> {
  const FIELDS =
    "id, entry_date, amount, currency, description, receipt_number, subcategory_id, transfer_group_id, is_opening_balance, voided_at";
  const first = await supabase
    .from("treasury_entries")
    .select(FIELDS)
    .eq("account_id", accountId)
    .lte("entry_date", upTo)
    .order("entry_date", { ascending: true });
  let rows: unknown[] | null = first.data as unknown[] | null;
  let error = first.error;
  if (error && error.code === "42703") {
    const legacy = await supabase
      .from("treasury_entries")
      .select(FIELDS.replace(", voided_at", ""))
      .eq("account_id", accountId)
      .lte("entry_date", upTo)
      .order("entry_date", { ascending: true });
    rows = legacy.data as unknown[] | null;
    error = legacy.error;
  }
  if (error) {
    console.error("[getAccountEntries]", error);
    return { entries: [], error: error.message };
  }
  type Row = Omit<ReconcileEntry, "rubro" | "voided_at"> & {
    subcategory_id: string;
    voided_at?: string | null;
  };
  return {
    entries: ((rows ?? []) as Row[]).map((r) => ({
      id: r.id,
      entry_date: r.entry_date,
      amount: Number(r.amount),
      currency: r.currency,
      description: r.description,
      receipt_number: r.receipt_number,
      rubro: rubroOf.get(r.subcategory_id) ?? null,
      transfer_group_id: r.transfer_group_id,
      is_opening_balance: r.is_opening_balance,
      voided_at: r.voided_at ?? null,
    })),
    error: null,
  };
}

/** Cuántos días alrededor de la cobertura se ofrecen movimientos para
 *  vincular a mano: más que la ventana del motor, porque a mano se
 *  vincula justamente lo que el motor no vio. */
export const CANDIDATE_WINDOW_DAYS = 30;

/**
 * El estado completo de una cuenta para la pantalla. `null` si la 061 no
 * corrió. Son unas decenas de filas por cuenta, no miles: se arma en TS.
 */
export async function getAccountReconciliation(
  supabase: SupabaseClient,
  accountId: string
): Promise<AccountReconciliation | null> {
  const imports = await getImports(supabase, accountId);
  if (imports.missing) return null;

  const lines = await getStoredLines(supabase, accountId);
  const coverage =
    lines.length > 0
      ? { from: lines[0].line_date, to: lines[lines.length - 1].line_date }
      : null;

  const matches = await getMatches(supabase, lines.map((l) => l.id));
  const byLine = new Map<string, StoredMatch[]>();
  for (const m of matches) {
    const arr = byLine.get(m.line_id) ?? [];
    arr.push(m);
    byLine.set(m.line_id, arr);
  }
  const matchedEntryIds = new Set(matches.map((m) => m.entry_id));

  const rubroOf = await getRubroNames(supabase);
  const upTo = coverage ? shiftDate(coverage.to, CANDIDATE_WINDOW_DAYS) : "9999-12-31";
  const { entries } = await getAccountEntries(supabase, accountId, upTo, rubroOf);
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const pending: StoredLine[] = [];
  const matched: LineView[] = [];
  const dismissed: StoredLine[] = [];
  for (const l of lines) {
    const ms = byLine.get(l.id) ?? [];
    if (ms.length > 0) {
      const es = ms.map((m) => entryById.get(m.entry_id)).filter((e): e is ReconcileEntry => !!e);
      const sum = es.reduce((s, e) => addMoney(s, e.amount), 0);
      matched.push({
        line: l,
        entries: es,
        kinds: ms.map((m) => m.kind),
        manual: ms.some((m) => m.matched_by === "tesorero"),
        diff: addMoney(l.amount, -sum),
      });
    } else if (l.dismissed_at) {
      dismissed.push(l);
    } else {
      pending.push(l);
    }
  }

  const live = entries.filter((e) => !e.voided_at && !e.is_opening_balance && !matchedEntryIds.has(e.id));
  const pendingEntries = coverage
    ? live.filter((e) => e.entry_date >= coverage.from && e.entry_date <= coverage.to)
    : [];
  const candidates = coverage
    ? live.filter(
        (e) =>
          e.entry_date >= shiftDate(coverage.from, -CANDIDATE_WINDOW_DAYS) &&
          e.entry_date <= shiftDate(coverage.to, CANDIDATE_WINDOW_DAYS)
      )
    : live;

  const withBalance = imports.rows.find((i) => i.closing_balance != null);
  const latestBalance = withBalance
    ? {
        amount: withBalance.closing_balance as number,
        currency: withBalance.currency,
        asOf: withBalance.closing_balance_as_of ?? withBalance.period_to,
      }
    : null;

  const totals = coverage
    ? reconcileTotals(lines.map(toStatementLine), entries, {
        from: coverage.from,
        to: coverage.to,
        statementBalance: latestBalance,
      })
    : [];

  // Más reciente arriba en pendientes; el resto por fecha.
  pending.sort((a, b) => (a.line_date < b.line_date ? 1 : a.line_date > b.line_date ? -1 : 0));
  pendingEntries.sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0));

  return {
    imports: imports.rows,
    coverage,
    totals,
    latestBalance,
    pending,
    matched,
    dismissed,
    pendingEntries,
    candidates,
  };
}

// ─── "Conciliado", derivado ────────────────────────────────────────────

export type AccountMonthStatus = {
  accountId: string;
  accountName: string;
  status: "conciliado" | "pendiente" | "sin-extracto";
  pendingLines: number;
  pendingEntries: number;
};

type MonthEntry = {
  id: string;
  account_id: string;
  entry_date: string;
  voided_at: string | null;
  is_opening_balance: boolean;
};

/**
 * El estado de conciliación de un mes civil, cuenta por cuenta. Solo las
 * cuentas que alguna vez importaron un extracto: Caja Chica no tiene
 * extracto y listarla como "sin extracto" cada mes sería ruido.
 *
 *  · conciliado: hay líneas en el mes, ninguna pendiente, y ningún
 *    movimiento del libro de esa cuenta en el mes quedó sin par.
 *  · pendiente: hay líneas en el mes y algo quedó suelto de algún lado.
 *  · sin-extracto: ninguna línea cae en el mes (no se importó, o eBROU
 *    no lo cubrió).
 */
export function monthReconciliation(
  month: string,
  lines: StoredLine[],
  matches: StoredMatch[],
  entries: MonthEntry[],
  accountNames: Map<string, string>,
  accountsWithImports: Set<string>
): AccountMonthStatus[] {
  const matchedLineIds = new Set(matches.map((m) => m.line_id));
  const matchedEntryIds = new Set(matches.map((m) => m.entry_id));
  const inMonth = (iso: string) => iso.slice(0, 7) === month;

  return [...accountsWithImports]
    .map((accountId) => {
      const monthLines = lines.filter((l) => l.account_id === accountId && inMonth(l.line_date));
      const pendingLines = monthLines.filter((l) => !matchedLineIds.has(l.id) && !l.dismissed_at).length;
      const pendingEntries = entries.filter(
        (e) =>
          e.account_id === accountId &&
          inMonth(e.entry_date) &&
          !e.voided_at &&
          !e.is_opening_balance &&
          !matchedEntryIds.has(e.id)
      ).length;
      const status: AccountMonthStatus["status"] =
        monthLines.length === 0
          ? "sin-extracto"
          : pendingLines === 0 && pendingEntries === 0
            ? "conciliado"
            : "pendiente";
      return {
        accountId,
        accountName: accountNames.get(accountId) ?? "Cuenta",
        status,
        pendingLines,
        pendingEntries,
      };
    })
    .sort((a, b) => a.accountName.localeCompare(b.accountName, "es"));
}
