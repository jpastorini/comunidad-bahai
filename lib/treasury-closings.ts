import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  monthKeyOf,
  monthRange,
  nextMonthKey,
  type CashbookEntry,
  type CashbookNames,
} from "./treasury-cashbook";
import { todayISO } from "./treasury-ledger";

/**
 * Cierres mensuales del libro (migración 054) — capa de datos.
 *
 * Un cierre congela un mes civil: el trigger `treasury_entries_guard` no
 * deja insertar, modificar ni borrar movimientos de ese mes, y el Libro
 * de Caja de ese mes se puede imprimir en limpio y pegar en el libro de
 * tapas duras. Los cierres son CONSECUTIVOS: el primero es el mes del
 * primer movimiento del libro y cada uno exige el anterior cerrado, que
 * es la única forma de que el "saldo anterior" de cada hoja sea un número
 * que ya nadie puede mover.
 *
 * Todo exige el tag `can_manage_treasury`; la RLS filtra las filas.
 */

export type TreasuryClosing = {
  id: string;
  /** "2026-08-01": el primer día del mes cerrado. */
  period_month: string;
  status: "closed" | "reopened";
  closed_at: string;
  closed_by: string | null;
  snapshot: unknown;
  entries_count: number;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
};

/** "2026-08-01" → "2026-08". */
export function closingMonthKey(c: Pick<TreasuryClosing, "period_month">): string {
  return monthKeyOf(c.period_month);
}

export async function getClosings(supabase: SupabaseClient): Promise<TreasuryClosing[]> {
  const { data, error } = await supabase
    .from("treasury_closings")
    .select(
      "id, period_month, status, closed_at, closed_by, snapshot, entries_count, reopened_at, reopened_by, reopen_reason"
    )
    .order("period_month", { ascending: true })
    .order("closed_at", { ascending: true });
  if (error) {
    // Antes de correr la 054 la tabla no existe: el libro sigue andando
    // como siempre, sin meses cerrados.
    console.error("[getClosings]", error);
    return [];
  }
  return (data ?? []) as TreasuryClosing[];
}

/** Los meses con cierre VIGENTE, como "YYYY-MM". */
export function closedMonthKeys(closings: TreasuryClosing[]): string[] {
  return closings.filter((c) => c.status === "closed").map(closingMonthKey).sort();
}

/** El cierre vigente de un mes, si lo hay. */
export function closingFor(
  closings: TreasuryClosing[],
  month: string
): TreasuryClosing | null {
  return (
    closings.find((c) => c.status === "closed" && closingMonthKey(c) === month) ?? null
  );
}

/**
 * Qué mes corresponde cerrar ahora: el siguiente al último cerrado, o el
 * del primer movimiento del libro si todavía no se cerró ninguno. Null si
 * el libro está vacío o si ese mes todavía no terminó (no se cierra un
 * mes en curso).
 */
export function nextMonthToClose(
  closings: TreasuryClosing[],
  firstEntryMonth: string | null,
  today: string = todayISO()
): string | null {
  const closed = closedMonthKeys(closings);
  const candidate =
    closed.length > 0 ? nextMonthKey(closed[closed.length - 1]) : firstEntryMonth;
  if (!candidate) return null;
  // Solo un mes ya transcurrido entero.
  return monthRange(candidate).to < today ? candidate : null;
}

/** El último mes cerrado, que es el único que se puede reabrir. */
export function lastClosedMonth(closings: TreasuryClosing[]): string | null {
  const closed = closedMonthKeys(closings);
  return closed.length > 0 ? closed[closed.length - 1] : null;
}

/** El mes del primer movimiento del libro, o null si está vacío. */
export async function getFirstEntryMonth(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("treasury_entries")
    .select("entry_date")
    .order("entry_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const row = data as { entry_date: string } | null;
  return row ? monthKeyOf(row.entry_date) : null;
}

/**
 * Todo el libro hasta el último día de `month`, con las columnas que el
 * Libro de Caja necesita. Son decenas de filas por año, no miles.
 */
export async function getCashbookEntries(
  supabase: SupabaseClient,
  month: string
): Promise<CashbookEntry[]> {
  const { to } = monthRange(month);
  const { data } = await supabase
    .from("treasury_entries")
    .select(
      "id, entry_date, account_id, subcategory_id, currency, amount, description, receipt_number, contributions_count, transfer_group_id, is_opening_balance, voided_at, adjusts_entry_id"
    )
    .lte("entry_date", to)
    .order("entry_date", { ascending: true });
  return ((data ?? []) as CashbookEntry[]).map((e) => ({ ...e, amount: Number(e.amount) }));
}

export async function getCashbookNames(supabase: SupabaseClient): Promise<CashbookNames> {
  const [accounts, subcategories] = await Promise.all([
    supabase.from("treasury_accounts").select("id, name"),
    supabase.from("treasury_subcategories").select("id, name"),
  ]);
  const toMap = (rows: unknown) =>
    new Map(
      ((rows ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name])
    );
  return { accounts: toMap(accounts.data), subcategories: toMap(subcategories.data) };
}

/** Nombres de quienes cerraron o reabrieron, para la pantalla de cierres. */
export async function getCloserNames(
  supabase: SupabaseClient,
  closings: TreasuryClosing[]
): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const c of closings) {
    if (c.closed_by) ids.add(c.closed_by);
    if (c.reopened_by) ids.add(c.reopened_by);
  }
  if (ids.size === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [...ids]);
  return new Map(
    ((data ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
      p.id,
      p.full_name ?? "—",
    ])
  );
}
