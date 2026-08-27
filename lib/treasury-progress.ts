import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMoney } from "./treasury-format";
import {
  BUDGET_CURRENCY,
  type ProgressCategory,
  type ProgressData,
  type ProgressGoal,
  type ProgressMonth,
  type ProgressMoney,
} from "./treasury-progress-content";
import {
  treasuryMonthCount,
  treasuryMonths,
  treasuryYearElapsed,
  treasuryYearEnd,
  treasuryYearForDate,
  treasuryYearStart,
} from "./treasury-year";

/**
 * Progreso contra el presupuesto y las metas — capa de datos.
 *
 * Los totales del libro NO se leen acá: salen de la función
 * `treasury_progress()` (migración 042), que es security definer y
 * devuelve solo agregados. Así la misma pantalla sirve al tesorero y a
 * un creyente cualquiera, y **los dos ven exactamente los mismos
 * números**, porque hay una sola implementación de la suma.
 *
 * El calendario vive de este lado: la función SQL recibe las fechas del
 * ejercicio ya resueltas (Riḍván a Riḍván) y no sabe nada de meses
 * bahá'ís. Ver lib/treasury-year.ts.
 */

type Agg = { id: string | null; c: string; a: number | string };
type DateAgg = { d: string; c: string; a: number | string; n: number | string };

type ProgressRpc = {
  contributionsByDate?: DateAgg[];
  spentByCategory?: Agg[];
  spentBySubcategory?: Agg[];
  spentByFund?: Agg[];
  receivedByFund?: Agg[];
  balanceByFund?: Agg[];
};

/** Índice {id → monto} para una moneda dada. */
function indexBy(rows: Agg[] | undefined, currency: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows ?? []) {
    if (r.c !== currency || !r.id) continue;
    map.set(r.id, addMoney(map.get(r.id) ?? 0, Number(r.a)));
  }
  return map;
}

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  badge: string | null;
  status: "activa" | "lograda" | "archivada";
  cadence: "mensual" | "anual" | "unica";
  direction: "gasto" | "ingreso";
  currency: string;
  target_amount: number | string | null;
  bahai_year: number | null;
  sort_order: number;
  ledger_fund_id: string | null;
  ledger_category_id: string | null;
  ledger_subcategory_id: string | null;
};

type BudgetItemRow = {
  id: string;
  category: string;
  icon: string;
  planned_amount: number | string;
  position: number;
  ledger_category_id: string | null;
  ledger_subcategory_id: string | null;
};

export async function getTreasuryProgress(
  supabase: SupabaseClient,
  opts: { localityId: string; asOf: string; bahaiYear?: number | null }
): Promise<ProgressData | null> {
  const year = opts.bahaiYear ?? treasuryYearForDate(opts.asOf);
  if (!year) return null;

  const from = treasuryYearStart(year);
  const end = treasuryYearEnd(year);
  const elapsed = treasuryYearElapsed(year, opts.asOf);
  if (!from || !end || !elapsed) return null;

  // El corte nunca pasa del cierre del ejercicio: un informe del año
  // pasado no debe seguir "avanzando" con el calendario.
  const asOf = opts.asOf > end ? end : opts.asOf;

  const [rpc, budgets, goals, funds] = await Promise.all([
    supabase.rpc("treasury_progress", {
      loc: opts.localityId,
      year_from: from,
      as_of: asOf,
    }),
    supabase
      .from("treasury_budgets")
      .select("id, period, bahai_year, status")
      .eq("locality_id", opts.localityId)
      .eq("bahai_year", year)
      .limit(1),
    supabase
      .from("treasury_goals")
      .select(
        "id, title, description, badge, status, cadence, direction, currency, target_amount, bahai_year, sort_order, ledger_fund_id, ledger_category_id, ledger_subcategory_id"
      )
      .eq("locality_id", opts.localityId)
      .neq("status", "archivada")
      .order("sort_order"),
    supabase.from("treasury_funds").select("id, name"),
  ]);

  const agg = (rpc.data ?? {}) as ProgressRpc;
  const fundNames = new Map(
    ((funds.data ?? []) as Array<{ id: string; name: string }>).map((f) => [
      f.id,
      f.name,
    ])
  );

  // ─── Contribuciones por tramo de mes bahá'í ────────────────────
  const monthDefs = treasuryMonths(year);
  const monthCount = treasuryMonthCount(year) || 19;

  let received = 0;
  let receivedCount = 0;
  const otherByCurrency = new Map<string, number>();
  const perMonth = new Map<string, { amount: number; count: number }>();

  for (const row of agg.contributionsByDate ?? []) {
    const amount = Number(row.a);
    if (row.c !== BUDGET_CURRENCY) {
      otherByCurrency.set(
        row.c,
        addMoney(otherByCurrency.get(row.c) ?? 0, amount)
      );
      continue;
    }
    received = addMoney(received, amount);
    receivedCount += Number(row.n);
    const bucket = monthDefs.find((m) => row.d >= m.from && row.d <= m.to);
    if (bucket) {
      const cur = perMonth.get(bucket.key) ?? { amount: 0, count: 0 };
      cur.amount = addMoney(cur.amount, amount);
      cur.count += Number(row.n);
      perMonth.set(bucket.key, cur);
    }
  }

  const receivedOther: ProgressMoney[] = [...otherByCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  // ─── Presupuesto ───────────────────────────────────────────────
  const budgetRow = ((budgets.data ?? [])[0] ?? null) as
    | { id: string; period: string }
    | null;

  let items: BudgetItemRow[] = [];
  if (budgetRow) {
    const { data } = await supabase
      .from("treasury_budget_items")
      .select(
        "id, category, icon, planned_amount, position, ledger_category_id, ledger_subcategory_id"
      )
      .eq("budget_id", budgetRow.id)
      .gt("planned_amount", 0)
      .order("position");
    items = (data ?? []) as BudgetItemRow[];
  }

  const spentByCategory = indexBy(agg.spentByCategory, BUDGET_CURRENCY);
  const spentBySubcategory = indexBy(agg.spentBySubcategory, BUDGET_CURRENCY);
  const spentByFund = indexBy(agg.spentByFund, BUDGET_CURRENCY);
  const receivedByFund = indexBy(agg.receivedByFund, BUDGET_CURRENCY);

  const categories: ProgressCategory[] = items.map((it) => ({
    id: it.id,
    category: it.category,
    icon: it.icon || "default",
    planned: Number(it.planned_amount),
    // La subcategoría manda: es el vínculo más específico.
    actual: it.ledger_subcategory_id
      ? (spentBySubcategory.get(it.ledger_subcategory_id) ?? 0)
      : it.ledger_category_id
        ? (spentByCategory.get(it.ledger_category_id) ?? 0)
        : 0,
    linked: Boolean(it.ledger_subcategory_id || it.ledger_category_id),
  }));

  const totalPlanned = categories.reduce((sum, c) => sum + c.planned, 0);
  const requiredPerMonth = monthCount > 0 ? totalPlanned / monthCount : 0;

  const budget =
    budgetRow && totalPlanned > 0
      ? {
          period: budgetRow.period,
          totalPlanned,
          requiredPerMonth,
          // La pauta se mide en DÍAS, no en meses cerrados: uno mira
          // esto en mitad de un mes casi siempre.
          expectedToDate:
            Math.round(totalPlanned * elapsed.fraction * 100) / 100,
        }
      : null;

  // ─── Tramos mensuales ──────────────────────────────────────────
  const monthDays = (from_: string, to_: string) =>
    Math.round(
      (new Date(`${to_}T00:00:00Z`).getTime() -
        new Date(`${from_}T00:00:00Z`).getTime()) /
        86_400_000
    ) + 1;

  const months: ProgressMonth[] = monthDefs
    // Los tramos que todavía no empezaron no se dibujan: la pantalla
    // crece con el año en vez de arrancar con 20 barras vacías.
    .filter((m) => m.from <= asOf)
    .map((m) => {
      const got = perMonth.get(m.key) ?? { amount: 0, count: 0 };
      // Un tramo parcial exige proporcionalmente menos.
      const share = m.partial ? monthDays(m.from, m.to) / 19 : 1;
      return {
        key: m.key,
        label: m.name,
        from: m.from,
        to: m.to,
        partial: m.partial,
        received: got.amount,
        contributions: got.count,
        required: Math.round(requiredPerMonth * share * 100) / 100,
        inProgress: m.to > asOf,
      };
    });

  // ─── Metas ─────────────────────────────────────────────────────
  const monthsElapsed = Math.max(elapsed.fraction * monthCount, 0);

  const goalRows = ((goals.data ?? []) as GoalRow[]).filter(
    (g) => g.bahai_year === null || g.bahai_year === year
  );

  const progressGoals: ProgressGoal[] = goalRows.map((g) => {
    const target = g.target_amount === null ? null : Number(g.target_amount);
    const linked = Boolean(
      g.ledger_subcategory_id || g.ledger_category_id || g.ledger_fund_id
    );

    let actual = 0;
    if (g.currency === BUDGET_CURRENCY) {
      const bySub = g.direction === "gasto" ? spentBySubcategory : null;
      const byCat = g.direction === "gasto" ? spentByCategory : null;
      const byFund = g.direction === "gasto" ? spentByFund : receivedByFund;
      if (g.ledger_subcategory_id && bySub) {
        actual = bySub.get(g.ledger_subcategory_id) ?? 0;
      } else if (g.ledger_category_id && byCat) {
        actual = byCat.get(g.ledger_category_id) ?? 0;
      } else if (g.ledger_fund_id) {
        actual = byFund.get(g.ledger_fund_id) ?? 0;
      }
    }

    // Una meta mensual se compara contra el acumulado que corresponde a
    // los meses transcurridos, no contra el objetivo de un mes suelto:
    // si no, en el mes 8 diría "cumplida" con un solo aporte.
    const targetToDate =
      target === null
        ? null
        : g.cadence === "mensual"
          ? Math.round(target * monthsElapsed * 100) / 100
          : target;

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      badge: g.badge,
      status: g.status,
      cadence: g.cadence,
      direction: g.direction,
      currency: g.currency,
      target,
      actual,
      targetToDate,
      measurable: target !== null && linked,
    };
  });

  // ─── Saldos por fondo ──────────────────────────────────────────
  const balances = ((agg.balanceByFund ?? []) as Agg[])
    .map((r) => ({
      label: (r.id && fundNames.get(r.id)) || "Sin fondo",
      currency: r.c,
      amount: Number(r.a),
    }))
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, "es") ||
        a.currency.localeCompare(b.currency)
    );

  const spent = categories.reduce((sum, c) => sum + c.actual, 0);

  return {
    bahaiYear: year,
    from,
    to: end,
    asOf,
    elapsed,
    budget,
    received,
    receivedCount,
    receivedOther,
    spent,
    months,
    categories,
    goals: progressGoals,
    balances,
  };
}

// ─── CRUD de metas (solo tesorero) ───────────────────────────────

export type TreasuryGoal = GoalRow;

export async function getGoals(
  supabase: SupabaseClient,
  localityId: string
): Promise<TreasuryGoal[]> {
  const { data } = await supabase
    .from("treasury_goals")
    .select(
      "id, title, description, badge, status, cadence, direction, currency, target_amount, bahai_year, sort_order, ledger_fund_id, ledger_category_id, ledger_subcategory_id"
    )
    .eq("locality_id", localityId)
    .order("status")
    .order("sort_order");
  return ((data ?? []) as TreasuryGoal[]).map((g) => ({
    ...g,
    target_amount: g.target_amount === null ? null : Number(g.target_amount),
  }));
}
