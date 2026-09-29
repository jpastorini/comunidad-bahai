import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECEIPTS_BUCKET, SIGNED_URL_TTL_SECONDS } from "./treasury-attachments";

/**
 * Cajas chicas (074) — capa de datos, server-only.
 *
 * Todo lo que lee acá lo filtra la RLS: el tesorero ve las cajas de su
 * localidad; el responsable, la suya y sus rendiciones. Ninguna función
 * decide permisos: si una consulta vuelve vacía, es porque la base no
 * mostró nada.
 */

export type CashCurrency = "UYU" | "USD";
export const CASH_CURRENCIES: CashCurrency[] = ["UYU", "USD"];

export type Money = { currency: string; amount: number };

export type CashBox = {
  id: string;
  locality_id: string;
  account_id: string;
  holder_profile_id: string | null;
  source_account_id: string | null;
  default_fund_id: string | null;
  fixed_uyu: number;
  fixed_usd: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CashReportStatus = "borrador" | "enviada" | "devuelta" | "aprobada";

export const CASH_REPORT_STATUS_LABEL: Record<CashReportStatus, string> = {
  borrador: "En preparación",
  enviada: "Enviada, esperando revisión",
  devuelta: "Devuelta para corregir",
  aprobada: "Aprobada",
};

export type CashReport = {
  id: string;
  locality_id: string;
  box_id: string;
  status: CashReportStatus;
  counted_uyu: number | null;
  counted_usd: number | null;
  expected_uyu: number | null;
  expected_usd: number | null;
  note: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  transfer_group_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CashLine = {
  id: string;
  report_id: string;
  line_date: string;
  currency: CashCurrency;
  amount: number;
  subcategory_id: string | null;
  description: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  entry_id: string | null;
  created_at: string;
};

export type SignedCashLine = CashLine & { url: string | null };

export type CashCount = {
  id: string;
  box_id: string;
  counted_on: string;
  counted_uyu: number;
  counted_usd: number;
  expected_uyu: number;
  expected_usd: number;
  note: string | null;
  counted_by: string | null;
  created_at: string;
};

const BOX_COLUMNS =
  "id, locality_id, account_id, holder_profile_id, source_account_id, default_fund_id, fixed_uyu, fixed_usd, notes, is_active, created_at, updated_at";
const REPORT_COLUMNS =
  "id, locality_id, box_id, status, counted_uyu, counted_usd, expected_uyu, expected_usd, note, submitted_at, submitted_by, reviewed_at, reviewed_by, review_note, transfer_group_id, created_at, updated_at";
const LINE_COLUMNS =
  "id, report_id, line_date, currency, amount, subcategory_id, description, storage_path, file_name, mime_type, size_bytes, entry_id, created_at";
const COUNT_COLUMNS =
  "id, box_id, counted_on, counted_uyu, counted_usd, expected_uyu, expected_usd, note, counted_by, created_at";

/** Antes de la 074 las tablas no existen. */
export function isCashSchemaMissing(error: { code?: string } | null | undefined): boolean {
  const c = error?.code;
  return c === "42P01" || c === "42703" || c === "PGRST205" || c === "PGRST202" || c === "42883";
}

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function normalizeBox(r: Record<string, unknown>): CashBox {
  return { ...(r as CashBox), fixed_uyu: num(r.fixed_uyu), fixed_usd: num(r.fixed_usd) };
}

function normalizeReport(r: Record<string, unknown>): CashReport {
  return {
    ...(r as CashReport),
    counted_uyu: numOrNull(r.counted_uyu),
    counted_usd: numOrNull(r.counted_usd),
    expected_uyu: numOrNull(r.expected_uyu),
    expected_usd: numOrNull(r.expected_usd),
  };
}

function normalizeLine(r: Record<string, unknown>): CashLine {
  return { ...(r as CashLine), amount: num(r.amount), size_bytes: numOrNull(r.size_bytes) };
}

function normalizeCount(r: Record<string, unknown>): CashCount {
  return {
    ...(r as CashCount),
    counted_uyu: num(r.counted_uyu),
    counted_usd: num(r.counted_usd),
    expected_uyu: num(r.expected_uyu),
    expected_usd: num(r.expected_usd),
  };
}

// ─── Lecturas ────────────────────────────────────────────────────

export async function getCashBoxes(
  supabase: SupabaseClient,
  opts: { includeInactive?: boolean } = {}
): Promise<{ boxes: CashBox[]; missing: boolean }> {
  let q = supabase.from("treasury_cash_boxes").select(BOX_COLUMNS).order("created_at");
  if (!opts.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) {
    if (!isCashSchemaMissing(error)) console.error("[getCashBoxes]", error);
    return { boxes: [], missing: isCashSchemaMissing(error) };
  }
  return { boxes: ((data ?? []) as Record<string, unknown>[]).map(normalizeBox), missing: false };
}

export async function getCashBox(supabase: SupabaseClient, id: string): Promise<CashBox | null> {
  const { data, error } = await supabase
    .from("treasury_cash_boxes")
    .select(BOX_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeBox(data as Record<string, unknown>);
}

/** El saldo de la caja según el libro, por moneda (solo números; RPC). */
export async function getCashBoxBalance(supabase: SupabaseClient, boxId: string): Promise<Money[]> {
  const { data, error } = await supabase.rpc("cash_box_balance", { p_box: boxId });
  if (error) {
    if (!isCashSchemaMissing(error)) console.error("[getCashBoxBalance]", error);
    return [];
  }
  return ((data ?? []) as Money[]).map((m) => ({ currency: m.currency, amount: Number(m.amount) }));
}

export async function getCashReports(
  supabase: SupabaseClient,
  opts: { boxId?: string; statuses?: CashReportStatus[]; limit?: number } = {}
): Promise<CashReport[]> {
  let q = supabase
    .from("treasury_cash_reports")
    .select(REPORT_COLUMNS)
    .order("created_at", { ascending: false });
  if (opts.boxId) q = q.eq("box_id", opts.boxId);
  if (opts.statuses && opts.statuses.length > 0) q = q.in("status", opts.statuses);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    if (!isCashSchemaMissing(error)) console.error("[getCashReports]", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeReport);
}

export async function getCashReport(supabase: SupabaseClient, id: string): Promise<CashReport | null> {
  const { data, error } = await supabase
    .from("treasury_cash_reports")
    .select(REPORT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeReport(data as Record<string, unknown>);
}

export async function getCashLines(supabase: SupabaseClient, reportIds: string[]): Promise<CashLine[]> {
  if (reportIds.length === 0) return [];
  const { data, error } = await supabase
    .from("treasury_cash_lines")
    .select(LINE_COLUMNS)
    .in("report_id", reportIds)
    .order("line_date")
    .order("created_at");
  if (error) {
    if (!isCashSchemaMissing(error)) console.error("[getCashLines]", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeLine);
}

/** Firma las URL de los comprobantes de las líneas (una hora). */
export async function signCashLines(
  supabase: SupabaseClient,
  lines: CashLine[]
): Promise<SignedCashLine[]> {
  const paths = lines.map((l) => l.storage_path).filter((p): p is string => !!p);
  const byPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) console.error("[signCashLines]", error);
    for (const row of data ?? []) if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
  }
  return lines.map((l) => ({ ...l, url: l.storage_path ? byPath.get(l.storage_path) ?? null : null }));
}

export async function getCashCounts(
  supabase: SupabaseClient,
  boxId: string,
  limit = 12
): Promise<CashCount[]> {
  const { data, error } = await supabase
    .from("treasury_cash_counts")
    .select(COUNT_COLUMNS)
    .eq("box_id", boxId)
    .order("counted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isCashSchemaMissing(error)) console.error("[getCashCounts]", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeCount);
}

/** El último arqueo de cada caja. */
export async function getLastCounts(supabase: SupabaseClient): Promise<Map<string, CashCount>> {
  const { data, error } = await supabase
    .from("treasury_cash_counts")
    .select(COUNT_COLUMNS)
    .order("counted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  const out = new Map<string, CashCount>();
  if (error) {
    if (!isCashSchemaMissing(error)) console.error("[getLastCounts]", error);
    return out;
  }
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const c = normalizeCount(raw);
    if (!out.has(c.box_id)) out.set(c.box_id, c);
  }
  return out;
}

// ─── Cálculos puros ──────────────────────────────────────────────

export function fixedOf(box: Pick<CashBox, "fixed_uyu" | "fixed_usd">): Money[] {
  const out: Money[] = [];
  if (box.fixed_uyu > 0) out.push({ currency: "UYU", amount: box.fixed_uyu });
  if (box.fixed_usd > 0) out.push({ currency: "USD", amount: box.fixed_usd });
  return out;
}

export function amountFor(list: Money[], currency: string): number {
  return list.find((m) => m.currency === currency)?.amount ?? 0;
}

/** Suma de las líneas por moneda. */
export function linesTotal(lines: Pick<CashLine, "currency" | "amount">[]): Money[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.currency, (map.get(l.currency) ?? 0) + l.amount);
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount }));
}

/**
 * Lo que la caja DEBERÍA tener en efectivo: el saldo del libro menos los
 * gastos que todavía no entraron (las líneas de la rendición abierta).
 * Por moneda, nunca sumadas.
 */
export function expectedCash(
  balance: Money[],
  pendingLines: Pick<CashLine, "currency" | "amount">[]
): Money[] {
  const spent = linesTotal(pendingLines);
  const currencies = new Set([...balance.map((b) => b.currency), ...spent.map((s) => s.currency)]);
  return [...currencies]
    .sort()
    .map((currency) => ({
      currency,
      amount: Math.round((amountFor(balance, currency) - amountFor(spent, currency)) * 100) / 100,
    }));
}

/** Diferencia contado − esperado, por moneda; vacío si todo cuadra. */
export function cashDifferences(
  counted: Money[],
  expected: Money[]
): Array<Money & { expected: number; counted: number }> {
  const currencies = new Set([...counted.map((c) => c.currency), ...expected.map((e) => e.currency)]);
  return [...currencies]
    .sort()
    .map((currency) => {
      const c = amountFor(counted, currency);
      const e = amountFor(expected, currency);
      return { currency, counted: c, expected: e, amount: Math.round((c - e) * 100) / 100 };
    })
    .filter((d) => Math.abs(d.amount) >= 0.005);
}

/** Días desde una fecha ISO hasta hoy ISO. */
export function daysSince(iso: string, today: string): number {
  const a = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
