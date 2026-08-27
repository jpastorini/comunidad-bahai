import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "./supabase/admin";
import { addMoney } from "./treasury-format";
import {
  EMPTY_EDITORIAL,
  EMPTY_SNAPSHOT,
  monthLabel,
  sanitizeReportEditorial,
  sanitizeReportSnapshot,
  type ReportBalanceRow,
  type ReportBudgetLine,
  type ReportEditorial,
  type ReportExpenseLine,
  type ReportMoney,
  type ReportMonth,
  type ReportReceipt,
  type ReportSnapshot,
} from "./treasury-report-content";
import {
  previousDay,
  treasuryMonths,
  treasuryYearEnd,
  treasuryYearForDate,
  treasuryYearStart,
} from "./treasury-year";

/**
 * Informes de Tesorería — capa de datos.
 *
 * El tesorero da un rango de fechas y de acá sale el informe que se
 * presenta en la Fiesta. Tres reglas del dominio que el cálculo respeta:
 *
 *  1. Los INGRESOS y EGRESOS son los del rango. Los SALDOS, en cambio,
 *     son acumulados: un saldo no tiene período, es todo el libro hasta
 *     la fecha de cierre (incluidos los "Saldo anterior" del arrastre).
 *
 *  2. Las TRANSFERENCIAS no son movimiento del Fondo. Un cambio de caja
 *     o una compra de divisas son dos asientos atados por
 *     `transfer_group_id` que se cancelan entre sí; contarlos infla las
 *     dos columnas. Quedan fuera de ingresos y egresos, y el informe
 *     dice cuántos hubo. Ojo que los "Gastos por transferencia" (el
 *     costo del giro) NO llevan grupo: son gasto real y se cuentan.
 *
 *  3. Nunca se suman monedas distintas. Cada total es una lista de
 *     {moneda, monto}.
 *
 * Ver supabase/migrations/041_treasury_reports.sql.
 */

const REPORT_FIELDS =
  "id, locality_id, title, subtitle, period_from, period_to, bahai_year, editorial, snapshot, status, share_token, published_at, created_by, created_at, updated_at";

export type TreasuryReport = {
  id: string;
  locality_id: string;
  title: string;
  subtitle: string | null;
  period_from: string;
  period_to: string;
  bahai_year: number | null;
  editorial: ReportEditorial;
  snapshot: ReportSnapshot;
  status: "draft" | "published";
  share_token: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function parseRow(row: Record<string, unknown>): TreasuryReport {
  return {
    id: row.id as string,
    locality_id: row.locality_id as string,
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    period_from: row.period_from as string,
    period_to: row.period_to as string,
    bahai_year: (row.bahai_year as number | null) ?? null,
    editorial: sanitizeReportEditorial(row.editorial),
    snapshot: sanitizeReportSnapshot(row.snapshot),
    status: row.status === "published" ? "published" : "draft",
    share_token: row.share_token as string,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── Lectura ─────────────────────────────────────────────────────

export async function getAdminReports(
  supabase: SupabaseClient,
  localityId: string
): Promise<TreasuryReport[]> {
  const { data } = await supabase
    .from("treasury_reports")
    .select(REPORT_FIELDS)
    .eq("locality_id", localityId)
    .order("period_to", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(parseRow);
}

export async function getReport(
  supabase: SupabaseClient,
  id: string
): Promise<TreasuryReport | null> {
  const { data } = await supabase
    .from("treasury_reports")
    .select(REPORT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return data ? parseRow(data as Record<string, unknown>) : null;
}

/**
 * Informe por link público. Se resuelve con la service-role key porque
 * la página no exige login; solo devuelve informes publicados.
 */
export async function getPublicReport(
  token: string
): Promise<{ report: TreasuryReport; localityName: string } | null> {
  // Token = 64 hex chars; cortamos temprano cualquier otra cosa.
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const supabase = createSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("treasury_reports")
    .select(REPORT_FIELDS)
    .eq("share_token", token)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;

  const report = parseRow(data as Record<string, unknown>);
  const { data: loc } = await supabase
    .from("localities")
    .select("name")
    .eq("id", report.locality_id)
    .maybeSingle();

  return {
    report,
    localityName: (loc as { name: string } | null)?.name ?? "Comunidad Bahá'í",
  };
}

// ─── Período ─────────────────────────────────────────────────────

export type PeriodPreset = {
  key: string;
  label: string;
  from: string;
  to: string;
  /** Sugerencia para el subtítulo de la portada. */
  subtitle: string;
};

/**
 * Los períodos que el tesorero elige de una lista en vez de tipear dos
 * fechas: cada mes bahá'í, del día 1 al día previo al mes que sigue. Es
 * el corte natural del informe, porque el informe se presenta en la
 * Fiesta que abre el mes siguiente.
 *
 * Los tramos salen del EJERCICIO (Riḍván a Riḍván), no del año del
 * calendario: ofrecer los meses previos a Riḍván daría informes en cero,
 * porque el libro de ese ejercicio todavía no existía. El primer tramo
 * queda recortado al día de Riḍván.
 *
 * Las fechas quedan editables: en la práctica la Fiesta se celebra unos
 * días después de la fecha oficial y el tesorero corre el cierre.
 */
export function periodPresets(bahaiYear: number, today: string): PeriodPreset[] {
  const months = treasuryMonths(bahaiYear);
  if (months.length === 0) return [];

  const presets: PeriodPreset[] = [];
  for (const m of months) {
    // No ofrecemos tramos que todavía no empezaron.
    if (m.from > today) continue;
    const to = m.to > today ? today : m.to;
    const month = MONTH_NAMES[m.monthIndex - 1];
    presets.push({
      key: m.key,
      label: `${month.name}${m.partial ? " (parcial)" : ""} — ${shortRange(m.from, to)}`,
      from: m.from,
      to,
      subtitle: `${month.name} · «${month.meaning}» · ${bahaiYear} E.B.`,
    });
  }

  const yearStart = treasuryYearStart(bahaiYear);
  const yearEnd = treasuryYearEnd(bahaiYear);
  if (yearStart && yearEnd) {
    presets.push({
      key: `${bahaiYear}-full`,
      label: `Ejercicio ${bahaiYear} completo — desde Riḍván`,
      from: yearStart,
      to: yearEnd > today ? today : yearEnd,
      subtitle: `Ejercicio ${bahaiYear} de la Era Bahá'í`,
    });
  }

  return presets.reverse();
}

/** Nombre y significado de cada mes bahá'í, para el subtítulo. Copiados
 *  de BAHAI_MONTHS pero sin la transliteración con diacríticos raros,
 *  que en un título proyectado se lee peor. */
const MONTH_NAMES = [
  { name: "Bahá", meaning: "Esplendor" },
  { name: "Jalál", meaning: "Gloria" },
  { name: "Jamál", meaning: "Belleza" },
  { name: "ʻAẓamat", meaning: "Grandeza" },
  { name: "Núr", meaning: "Luz" },
  { name: "Raḥmat", meaning: "Misericordia" },
  { name: "Kalimát", meaning: "Palabras" },
  { name: "Kamál", meaning: "Perfección" },
  { name: "Asmáʼ", meaning: "Nombres" },
  { name: "ʻIzzat", meaning: "Poderío" },
  { name: "Mashíyyat", meaning: "Voluntad" },
  { name: "ʻIlm", meaning: "Conocimiento" },
  { name: "Qudrat", meaning: "Poder" },
  { name: "Qawl", meaning: "Palabra" },
  { name: "Masáʼil", meaning: "Preguntas" },
  { name: "Sharaf", meaning: "Honor" },
  { name: "Sulṭán", meaning: "Soberanía" },
  { name: "Mulk", meaning: "Dominio" },
  { name: "ʻAláʼ", meaning: "Sublimidad" },
];

function shortRange(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map((p) => parseInt(p, 10));
  const [, tm, td] = to.split("-").map((p) => parseInt(p, 10));
  return `${fd} ${monthLabel(fm).toLowerCase()} al ${td} ${monthLabel(tm).toLowerCase()}`;
}

// ─── Cálculo del snapshot ────────────────────────────────────────

type RawEntry = {
  entry_date: string;
  account_id: string;
  category_id: string;
  subcategory_id: string;
  fund_id: string | null;
  currency: string;
  amount: number;
  description: string | null;
  receipt_number: number | null;
  contributions_count: number;
  transfer_group_id: string | null;
  is_opening_balance: boolean;
};

/** Acumulador {moneda → monto} que se vuelca ordenado a ReportMoney[]. */
function currencyTotals(): {
  add: (currency: string, amount: number) => void;
  rows: () => ReportMoney[];
  get: (currency: string) => number;
  currencies: () => string[];
} {
  const map = new Map<string, number>();
  return {
    add(currency, amount) {
      map.set(currency, addMoney(map.get(currency) ?? 0, amount));
    },
    get(currency) {
      return map.get(currency) ?? 0;
    },
    currencies() {
      return [...map.keys()];
    },
    rows() {
      return [...map.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    },
  };
}

function balancesBy(
  entries: RawEntry[],
  dimension: "account_id" | "fund_id",
  names: Map<string, string>,
  fallbackLabel: string
): ReportBalanceRow[] {
  const totals = new Map<string, ReportBalanceRow>();
  for (const e of entries) {
    const id = e[dimension];
    const label = (id && names.get(id)) || fallbackLabel;
    const key = `${label}|${e.currency}`;
    const row = totals.get(key);
    if (row) row.amount = addMoney(row.amount, e.amount);
    else totals.set(key, { label, currency: e.currency, amount: e.amount });
  }
  // Los saldos en cero no se muestran: son cuentas que se abrieron y se
  // cerraron dentro del período y no dicen nada al lector.
  return [...totals.values()]
    .filter((r) => Math.abs(r.amount) >= 0.005)
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, "es") ||
        a.currency.localeCompare(b.currency)
    );
}

/** Aportes que representa un asiento de ingreso. `contributions_count`
 *  es cuántos agrupa (5 = la canasta de la Fiesta), pero hay asientos
 *  viejos con 0: ahí contamos 1, para que ningún aporte quede invisible. */
function contributionsOf(e: RawEntry): number {
  return e.contributions_count > 0 ? e.contributions_count : 1;
}

export type SnapshotInput = {
  localityId: string;
  from: string;
  to: string;
  bahaiYear: number | null;
};

/**
 * Arma el snapshot del informe leyendo el libro. Se llama al guardar,
 * nunca al renderizar: un informe ya presentado en la Fiesta no puede
 * cambiar porque después se cargó un movimiento más.
 */
export async function computeReportSnapshot(
  supabase: SupabaseClient,
  input: SnapshotInput
): Promise<ReportSnapshot> {
  const { from, to } = input;
  const bahaiYear = input.bahaiYear ?? treasuryYearForDate(to);

  // Todo el libro hasta el cierre: los saldos son acumulados, así que
  // no alcanza con el rango. Son decenas de filas por año, no miles.
  const [entriesRes, accountsRes, fundsRes, categoriesRes, subcategoriesRes] =
    await Promise.all([
      supabase
        .from("treasury_entries")
        .select(
          "entry_date, account_id, category_id, subcategory_id, fund_id, currency, amount, description, receipt_number, contributions_count, transfer_group_id, is_opening_balance"
        )
        .lte("entry_date", to)
        .order("entry_date", { ascending: true }),
      supabase.from("treasury_accounts").select("id, name"),
      supabase.from("treasury_funds").select("id, name"),
      supabase.from("treasury_categories").select("id, name"),
      supabase.from("treasury_subcategories").select("id, name"),
    ]);

  const all = ((entriesRes.data ?? []) as RawEntry[]).map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));

  const nameMap = (rows: unknown): Map<string, string> =>
    new Map(
      ((rows ?? []) as Array<{ id: string; name: string }>).map((r) => [
        r.id,
        r.name,
      ])
    );
  const accountNames = nameMap(accountsRes.data);
  const fundNames = nameMap(fundsRes.data);
  const categoryNames = nameMap(categoriesRes.data);
  const subcategoryNames = nameMap(subcategoriesRes.data);

  const inRange = all.filter((e) => e.entry_date >= from);
  // Movimiento real del Fondo: sin arrastre y sin transferencias.
  const movement = inRange.filter(
    (e) => !e.is_opening_balance && !e.transfer_group_id
  );

  const income = currencyTotals();
  const expense = currencyTotals();
  let incomeCount = 0;
  const receipts: ReportReceipt[] = [];
  const expenseLines: ReportExpenseLine[] = [];

  for (const e of movement) {
    if (e.amount > 0) {
      income.add(e.currency, e.amount);
      incomeCount += contributionsOf(e);
      receipts.push({
        number: e.receipt_number,
        date: e.entry_date,
        amount: e.amount,
        currency: e.currency,
        count: contributionsOf(e),
        fund: (e.fund_id && fundNames.get(e.fund_id)) || null,
      });
    } else {
      expense.add(e.currency, -e.amount);
      expenseLines.push({
        label:
          e.description?.trim() ||
          (e.subcategory_id && subcategoryNames.get(e.subcategory_id)) ||
          "Gasto",
        category: (e.category_id && categoryNames.get(e.category_id)) || null,
        fund: (e.fund_id && fundNames.get(e.fund_id)) || null,
        amount: -e.amount,
        currency: e.currency,
        date: e.entry_date,
      });
    }
  }

  receipts.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.number ?? 0) - (b.number ?? 0)
  );
  expenseLines.sort((a, b) => b.amount - a.amount);

  const receiptNumbers = receipts
    .map((r) => r.number)
    .filter((n): n is number => typeof n === "number");

  // Resultado del período: ingresos menos egresos, moneda por moneda.
  const result = currencyTotals();
  for (const currency of new Set([
    ...income.currencies(),
    ...expense.currencies(),
  ])) {
    result.add(currency, income.get(currency) - expense.get(currency));
  }

  const transferGroups = new Set(
    inRange.map((e) => e.transfer_group_id).filter(Boolean)
  );

  // ─── Serie mensual del año bahá'í ──────────────────────────────
  // El eje anual arranca en el primer día de Riḍván: el ejercicio
  // contable de la Asamblea, no el año del calendario. Arrancar en
  // Naw-Rúz metía en el gráfico un mes que el libro ni siquiera cubre.
  const seriesStart = (bahaiYear ? treasuryYearStart(bahaiYear) : null) ?? from;
  const localFundId = pickLocalFund(fundNames, all);
  const localFundCurrency = "UYU";
  const months = monthlySeries(
    all,
    seriesStart,
    to,
    localFundId,
    localFundCurrency
  );

  // ─── Presupuesto vs. ejecutado ─────────────────────────────────
  const budget = await budgetComparison(
    supabase,
    input.localityId,
    bahaiYear,
    all,
    seriesStart,
    to
  );

  return {
    from,
    to,
    bahaiYear,
    income: income.rows(),
    incomeCount,
    receiptFrom: receiptNumbers.length ? Math.min(...receiptNumbers) : null,
    receiptTo: receiptNumbers.length ? Math.max(...receiptNumbers) : null,
    receipts,
    expenses: expense.rows(),
    expenseLines,
    result: result.rows(),
    byFund: balancesBy(all, "fund_id", fundNames, "Sin fondo"),
    byAccount: balancesBy(all, "account_id", accountNames, "Sin cuenta"),
    months,
    localFund:
      localFundId && fundNames.get(localFundId)
        ? {
            name: fundNames.get(localFundId) as string,
            currency: localFundCurrency,
          }
        : null,
    budget,
    internalTransfers: transferGroups.size,
  };
}

/**
 * Cuál de los fondos es "el Fondo Local". No hay una marca en la base
 * (los fondos son filas con nombre libre por localidad), así que se
 * busca por nombre; si ninguno se llama así, se toma el de mayor saldo
 * en pesos, que en la práctica es el mismo.
 */
function pickLocalFund(
  fundNames: Map<string, string>,
  entries: RawEntry[]
): string | null {
  const norm = (s: string) => s.toLowerCase();
  for (const [id, name] of fundNames) {
    if (norm(name).includes("fondo local") || norm(name) === "local") return id;
  }
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (!e.fund_id || e.currency !== "UYU") continue;
    totals.set(e.fund_id, addMoney(totals.get(e.fund_id) ?? 0, e.amount));
  }
  let best: string | null = null;
  let bestAmount = -Infinity;
  for (const [id, amount] of totals) {
    if (amount > bestAmount) {
      best = id;
      bestAmount = amount;
    }
  }
  return best;
}

/**
 * Aportes por mes y saldo del Fondo Local al cierre de cada mes, desde
 * Naw-Rúz hasta el cierre del informe. El saldo es acumulado desde el
 * principio del libro, no desde Naw-Rúz: es un saldo, no un flujo.
 */
function monthlySeries(
  all: RawEntry[],
  start: string,
  end: string,
  localFundId: string | null,
  currency: string
): ReportMonth[] {
  const keys: string[] = [];
  const [sy, sm] = start.split("-").map((p) => parseInt(p, 10));
  const [ey, em] = end.split("-").map((p) => parseInt(p, 10));
  if (!sy || !sm || !ey || !em) return [];
  let y = sy;
  let m = sm;
  // Tope defensivo: 24 meses cubre cualquier año bahá'í y evita que un
  // rango mal cargado deje el bucle corriendo.
  while ((y < ey || (y === ey && m <= em)) && keys.length < 24) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const contributions = new Map<string, number>();
  for (const e of all) {
    if (e.entry_date < start || e.entry_date > end) continue;
    if (e.is_opening_balance || e.transfer_group_id || e.amount <= 0) continue;
    const key = e.entry_date.slice(0, 7);
    contributions.set(key, (contributions.get(key) ?? 0) + contributionsOf(e));
  }

  return keys.map((key) => {
    const monthEnd = lastDayOfMonth(key);
    const cap = monthEnd > end ? end : monthEnd;
    let balance = 0;
    if (localFundId) {
      for (const e of all) {
        if (e.entry_date > cap) continue;
        if (e.fund_id !== localFundId || e.currency !== currency) continue;
        balance = addMoney(balance, e.amount);
      }
    }
    const [yy, mm] = key.split("-").map((p) => parseInt(p, 10));
    return {
      key,
      label: monthLabel(mm) + (yy !== ey ? ` ${String(yy).slice(2)}` : ""),
      contributions: contributions.get(key) ?? 0,
      localFundBalance: balance,
    };
  });
}

function lastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map((p) => parseInt(p, 10));
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Presupuesto del año vs. ejecutado a la fecha de cierre. El ejecutado
 * es del AÑO, no del período: el presupuesto es anual y compararlo
 * contra 19 días no dice nada.
 *
 * Cada línea se ejecuta con los movimientos de la categoría (o
 * subcategoría) del libro que el tesorero le vinculó en el presupuesto.
 * Una línea sin vincular se informa como tal en vez de mostrar cero.
 */
async function budgetComparison(
  supabase: SupabaseClient,
  localityId: string,
  bahaiYear: number | null,
  all: RawEntry[],
  yearStart: string,
  to: string
): Promise<{ period: string; lines: ReportBudgetLine[] } | null> {
  let query = supabase
    .from("treasury_budgets")
    .select("id, period, bahai_year, status")
    .eq("locality_id", localityId);
  query = bahaiYear
    ? query.eq("bahai_year", bahaiYear)
    : query.eq("status", "active");

  const { data: budgets } = await query
    .order("status", { ascending: true })
    .limit(1);
  const budget = (budgets ?? [])[0] as
    | { id: string; period: string }
    | undefined;
  if (!budget) return null;

  const { data: itemsRaw } = await supabase
    .from("treasury_budget_items")
    .select(
      "category, icon, planned_amount, position, ledger_category_id, ledger_subcategory_id"
    )
    .eq("budget_id", budget.id)
    .gt("planned_amount", 0)
    .order("position", { ascending: true });

  const items = (itemsRaw ?? []) as Array<{
    category: string;
    icon: string;
    planned_amount: number;
    ledger_category_id: string | null;
    ledger_subcategory_id: string | null;
  }>;
  if (items.length === 0) return null;

  // Ejecutado del año por categoría y por subcategoría del libro. Solo
  // gastos en pesos: el presupuesto se arma en pesos.
  const byCategory = new Map<string, number>();
  const bySubcategory = new Map<string, number>();
  for (const e of all) {
    if (e.entry_date < yearStart || e.entry_date > to) continue;
    if (e.is_opening_balance || e.transfer_group_id) continue;
    if (e.amount >= 0 || e.currency !== "UYU") continue;
    const spent = -e.amount;
    byCategory.set(
      e.category_id,
      addMoney(byCategory.get(e.category_id) ?? 0, spent)
    );
    bySubcategory.set(
      e.subcategory_id,
      addMoney(bySubcategory.get(e.subcategory_id) ?? 0, spent)
    );
  }

  const lines: ReportBudgetLine[] = items.map((it) => {
    // La subcategoría manda: es el vínculo más específico.
    const actual = it.ledger_subcategory_id
      ? bySubcategory.get(it.ledger_subcategory_id) ?? 0
      : it.ledger_category_id
        ? byCategory.get(it.ledger_category_id) ?? 0
        : 0;
    return {
      category: it.category,
      icon: it.icon || "default",
      planned: Number(it.planned_amount),
      actual,
      linked: Boolean(it.ledger_subcategory_id || it.ledger_category_id),
    };
  });

  return { period: budget.period, lines };
}

// ─── Sugerencias para un informe nuevo ───────────────────────────

/** Editorial inicial de un informe: la cita y la firma que casi siempre
 *  van, para que el tesorero corrija en vez de escribir de cero. */
export function suggestEditorial(treasurerName: string): ReportEditorial {
  return {
    ...EMPTY_EDITORIAL,
    quote: {
      text: "¡Oh Hijo del Hombre! Derrocha Mis bienes entre Mis pobres.",
      source: "Bahá'u'lláh · Palabras Ocultas",
    },
    signature: { name: treasurerName, role: "Tesorero de la Asamblea" },
  };
}

export { EMPTY_SNAPSHOT };
