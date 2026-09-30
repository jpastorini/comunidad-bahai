import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findingsOf, getDispositions } from "./treasury-audit-server";
import {
  cashDifferences,
  fixedOf,
  getCashBoxBalance,
  getCashBoxes,
  getCashReports,
  getLastCounts,
  type Money,
} from "./treasury-cash";
import { monthKeyOf, monthKeysBetween, monthLabel, monthRange, previousMonthKey } from "./treasury-cashbook";
import { closedMonthKeys, getClosings, getFirstEntryMonth } from "./treasury-closings";
import { getReceiptLegal, type ReceiptLegal } from "./treasury-ledger";
import { getCurrentPublication } from "./treasury-publications";
import { getImports, getMatches, getStoredLines, monthReconciliation } from "./treasury-statements";
import { treasuryYearForDate } from "./treasury-year";

/**
 * El acta de traspaso de la Tesorería: la foto del libro el día en que
 * cambia el tesorero, para que quien entrega y quien recibe firmen lo
 * mismo. Es lo primero que pide un auditor cuando cambia el cargo, y
 * hasta acá había que armarla a mano.
 *
 * Todo sale de tablas que ya existen y se calcula AL DÍA DEL ACTA
 * (`asOf`), no al mes: un traspaso cae en cualquier fecha. Nada se guarda:
 * el acta impresa y firmada es el documento; la app puede volver a
 * generarla para la misma fecha y va a decir lo mismo si el libro de esos
 * meses está cerrado, que es la idea.
 */

export type HandoverBalance = { account: string; currency: string; amount: number };

export type HandoverCashBox = {
  name: string;
  holder: string | null;
  fixed: Money[];
  balance: Money[];
  lastCount: { on: string; ok: boolean; diffs: string[] } | null;
  pendingReports: number;
};

export type HandoverData = {
  asOf: string;
  bahaiYear: number | null;
  legal: ReceiptLegal;
  balances: HandoverBalance[];
  totals: Money[];
  cashBoxes: HandoverCashBox[];
  closings: { lastClosed: string | null; openMonths: string[] };
  reconciliation: Array<{ account: string; month: string; status: string; pending: number }>;
  audit: { runAt: string | null; pendingHigh: number; pendingMedium: number } | null;
  receipts: { lastNumber: number | null; unissued: number; voided: number };
  publication: string | null;
  entriesCount: number;
};

export async function getHandoverData(
  supabase: SupabaseClient,
  opts: { localityId: string; asOf: string }
): Promise<HandoverData> {
  const { localityId, asOf } = opts;
  const month = monthKeyOf(asOf);
  const prevMonth = previousMonthKey(month);

  const [entriesRes, accountsRes, legal, closings, firstMonth, publication, cash, lastCounts, pendingReports, imports] =
    await Promise.all([
      supabase
        .from("treasury_entries")
        .select("id, account_id, currency, amount, entry_date, voided_at, receipt_number, receipt_issued, is_opening_balance")
        .lte("entry_date", asOf),
      supabase.from("treasury_accounts").select("id, name"),
      getReceiptLegal(supabase, localityId),
      getClosings(supabase),
      getFirstEntryMonth(supabase),
      getCurrentPublication(supabase, localityId),
      getCashBoxes(supabase),
      getLastCounts(supabase),
      getCashReports(supabase, { statuses: ["enviada", "borrador", "devuelta"] }),
      getImports(supabase),
    ]);

  type E = {
    id: string;
    account_id: string;
    currency: string;
    amount: number | string;
    entry_date: string;
    voided_at: string | null;
    receipt_number: number | null;
    receipt_issued: boolean;
    is_opening_balance: boolean;
  };
  const entries = ((entriesRes.data ?? []) as E[]).map((e) => ({ ...e, amount: Number(e.amount) }));
  const accountName = new Map(((accountsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));

  // Saldos por cuenta y moneda al día del acta, sin anulados.
  const bal = new Map<string, HandoverBalance>();
  const tot = new Map<string, number>();
  for (const e of entries) {
    if (e.voided_at) continue;
    const key = `${e.account_id}|${e.currency}`;
    const row = bal.get(key) ?? { account: accountName.get(e.account_id) ?? "Cuenta", currency: e.currency, amount: 0 };
    row.amount += e.amount;
    bal.set(key, row);
    tot.set(e.currency, (tot.get(e.currency) ?? 0) + e.amount);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const balances = [...bal.values()]
    .map((b) => ({ ...b, amount: round(b.amount) }))
    .sort((a, b) => a.account.localeCompare(b.account, "es") || a.currency.localeCompare(b.currency));
  const totals = [...tot.entries()].map(([currency, amount]) => ({ currency, amount: round(amount) })).sort((a, b) => a.currency.localeCompare(b.currency));

  // Cajas chicas.
  const holderIds = cash.boxes.map((b) => b.holder_profile_id).filter((x): x is string => !!x);
  const { data: holders } = holderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", holderIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const holderName = new Map(((holders ?? []) as { id: string; full_name: string | null }[]).map((h) => [h.id, h.full_name]));
  const cashBoxes: HandoverCashBox[] = [];
  for (const b of cash.boxes) {
    const balance = await getCashBoxBalance(supabase, b.id);
    const c = lastCounts.get(b.id) ?? null;
    const diffs = c
      ? cashDifferences(
          [
            { currency: "UYU", amount: c.counted_uyu },
            { currency: "USD", amount: c.counted_usd },
          ],
          [
            { currency: "UYU", amount: c.expected_uyu },
            { currency: "USD", amount: c.expected_usd },
          ]
        )
      : [];
    cashBoxes.push({
      name: accountName.get(b.account_id) ?? "Caja chica",
      holder: b.holder_profile_id ? holderName.get(b.holder_profile_id) ?? null : null,
      fixed: fixedOf(b),
      balance,
      lastCount: c
        ? {
            on: c.counted_on,
            ok: diffs.length === 0,
            diffs: diffs.map((d) => `${d.amount > 0 ? "sobran" : "faltan"} ${Math.abs(d.amount).toFixed(2)} ${d.currency}`),
          }
        : null,
      pendingReports: pendingReports.filter((r) => r.box_id === b.id).length,
    });
  }

  // Cierres: hasta qué mes está congelado y qué quedó abierto.
  const closed = closedMonthKeys(closings);
  const lastClosed = closed.length > 0 ? closed[closed.length - 1] : null;
  const openMonths = firstMonth
    ? monthKeysBetween(firstMonth, prevMonth).filter((m) => !closed.includes(m))
    : [];

  // Conciliación del mes anterior al acta, por cuenta con extracto.
  const reconciliation: HandoverData["reconciliation"] = [];
  if (!imports.missing && imports.rows.length > 0) {
    const [lines, matches] = await Promise.all([getStoredLines(supabase), getMatches(supabase)]);
    const withImports = new Set(imports.rows.map((i) => i.account_id));
    const range = monthRange(prevMonth);
    const monthEntries = entries
      .filter((e) => e.entry_date >= range.from && e.entry_date <= range.to)
      .map((e) => ({ id: e.id, account_id: e.account_id, entry_date: e.entry_date, voided_at: e.voided_at, is_opening_balance: e.is_opening_balance }));
    for (const st of monthReconciliation(prevMonth, lines, matches, monthEntries, accountName, withImports)) {
      reconciliation.push({ account: st.accountName, month: monthLabel(prevMonth), status: st.status, pending: st.pendingLines + st.pendingEntries });
    }
  }

  // Auditoría: la última corrida y lo que quedó sin resolver.
  let audit: HandoverData["audit"] = null;
  const { data: auditRow, error: auditErr } = await supabase
    .from("treasury_audits")
    .select("run_at, findings")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!auditErr) {
    const a = auditRow as { run_at: string; findings: unknown } | null;
    if (a) {
      const disp = await getDispositions(supabase);
      const settled = new Set(disp.filter((d) => d.status !== "pendiente").map((d) => d.finding_key));
      const pend = findingsOf(a.findings).filter((f) => !settled.has(f.key));
      audit = {
        runAt: a.run_at,
        pendingHigh: pend.filter((f) => f.severity === "alta").length,
        pendingMedium: pend.filter((f) => f.severity === "media").length,
      };
    } else {
      audit = { runAt: null, pendingHigh: 0, pendingMedium: 0 };
    }
  }

  // Recibos.
  const withReceipt = entries.filter((e) => e.receipt_number !== null);
  const receipts = {
    lastNumber: withReceipt.reduce<number | null>((m, e) => (m === null || (e.receipt_number ?? 0) > m ? e.receipt_number : m), null),
    unissued: withReceipt.filter((e) => e.amount > 0 && !e.receipt_issued && !e.voided_at).length,
    voided: withReceipt.filter((e) => e.voided_at).length,
  };

  return {
    asOf,
    bahaiYear: treasuryYearForDate(asOf),
    legal,
    balances,
    totals,
    cashBoxes,
    closings: { lastClosed, openMonths },
    reconciliation,
    audit,
    receipts,
    publication: publication?.published_at ?? null,
    entriesCount: entries.filter((e) => !e.voided_at).length,
  };
}
