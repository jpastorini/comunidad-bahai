import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { treasuryYearForDate } from "./treasury-year";

/**
 * Cómo se encuentra EL presupuesto de un ejercicio.
 *
 * `treasury_budgets.bahai_year` es opcional en el formulario de alta y
 * durante meses quedó en NULL: el presupuesto "183 EB" existía, con sus
 * $ 141.900, y el tablero de progreso decía "Sin presupuesto cargado"
 * porque filtraba `bahai_year = 183` a secas. Este módulo es el único
 * lugar que decide la coincidencia, para que el progreso, el informe y
 * cualquier pantalla nueva no puedan volver a divergir.
 *
 * Orden de preferencia, siempre dentro de la localidad:
 *  1. `bahai_year` igual al año pedido.
 *  2. Sin año cargado, pero el año aparece escrito en el período
 *     ("183 E.B. (2026–2027)" → 183).
 *  3. Sin año en ningún lado: el presupuesto ACTIVO, y solo para el
 *     ejercicio en curso (un informe del año pasado no puede colgarse
 *     del presupuesto de hoy).
 * Si varios empatan, manda el activo, después el borrador, después el
 * cerrado.
 */
export type BudgetHeader = {
  id: string;
  period: string;
  bahai_year: number | null;
  status: "draft" | "active" | "closed";
};

/** Año BE escrito dentro del período ("183 E.B." → 183), o null. */
export function bahaiYearFromPeriod(period: string | null | undefined): number | null {
  const m = (period ?? "").match(/\b(1\d\d)\b/);
  return m ? Number(m[1]) : null;
}

function statusRank(b: BudgetHeader): number {
  return b.status === "active" ? 0 : b.status === "draft" ? 1 : 2;
}

function pick(list: BudgetHeader[]): BudgetHeader | null {
  return [...list].sort((a, b) => statusRank(a) - statusRank(b))[0] ?? null;
}

export async function findBudgetForYear(
  supabase: SupabaseClient,
  localityId: string,
  year: number | null
): Promise<BudgetHeader | null> {
  const { data } = await supabase
    .from("treasury_budgets")
    .select("id, period, bahai_year, status")
    .eq("locality_id", localityId);
  const rows = (data ?? []) as BudgetHeader[];
  if (rows.length === 0) return null;

  if (!year) return pick(rows.filter((b) => b.status === "active"));

  const exact = rows.filter((b) => b.bahai_year === year);
  if (exact.length) return pick(exact);

  const byPeriod = rows.filter(
    (b) => b.bahai_year === null && bahaiYearFromPeriod(b.period) === year
  );
  if (byPeriod.length) return pick(byPeriod);

  const today = new Date().toISOString().slice(0, 10);
  if (treasuryYearForDate(today) !== year) return null;
  return pick(
    rows.filter(
      (b) =>
        b.status === "active" &&
        b.bahai_year === null &&
        bahaiYearFromPeriod(b.period) === null
    )
  );
}
