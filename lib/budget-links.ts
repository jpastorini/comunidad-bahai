import { addMoney } from "./treasury-format";

/**
 * Con qué rubros del libro se ejecuta una línea del presupuesto (067) y
 * con cuáles se mide una meta (068).
 *
 * Una línea puede vincular VARIAS categorías y subcategorías: el
 * "Mantenimiento" del presupuesto se gasta en "Centro Bahá'í -
 * Mantenimiento" y en "Centro Bahá'í - Gastos Fijos". Este módulo es el
 * único que sabe leer el vínculo y sumar lo ejecutado, y lo usan el
 * tablero de progreso, el informe, la auditoría y el catálogo.
 *
 * Puro, sin queries, para poder usarlo de los dos lados.
 */

export type BudgetLinkRow = {
  /** Columnas de la 042, un solo rubro. Se leen por compatibilidad. */
  ledger_category_id?: string | null;
  ledger_subcategory_id?: string | null;
  /** Listas de la 067. */
  ledger_category_ids?: string[] | null;
  ledger_subcategory_ids?: string[] | null;
};

export type BudgetLinks = { categories: string[]; subcategories: string[] };

/** Las dos listas, sin repetidos, sumando las columnas viejas si las hay
 *  (una base sin la 067, o una fila que nadie volvió a guardar). */
export function budgetLinks(row: BudgetLinkRow): BudgetLinks {
  const categories = new Set(row.ledger_category_ids ?? []);
  if (row.ledger_category_id) categories.add(row.ledger_category_id);
  const subcategories = new Set(row.ledger_subcategory_ids ?? []);
  if (row.ledger_subcategory_id) subcategories.add(row.ledger_subcategory_id);
  return { categories: [...categories], subcategories: [...subcategories] };
}

export function isLinked(row: BudgetLinkRow): boolean {
  const l = budgetLinks(row);
  return l.categories.length + l.subcategories.length > 0;
}

/**
 * Lo ejecutado por una línea: la suma de sus categorías más la de sus
 * subcategorías, **sin contar dos veces**. Si la línea tiene una categoría
 * entera y además una subcategoría de adentro, la subcategoría ya está en
 * la categoría y no se vuelve a sumar. Para saberlo hace falta de qué
 * categoría es cada subcategoría (`subParent`).
 */
export function linkedActual(
  row: BudgetLinkRow,
  spentByCategory: Map<string, number>,
  spentBySubcategory: Map<string, number>,
  subParent: Map<string, string>
): number {
  const { categories, subcategories } = budgetLinks(row);
  return sumRubros(categories, subcategories, spentByCategory, spentBySubcategory, subParent);
}

function sumRubros(
  categories: string[],
  subcategories: string[],
  byCategory: Map<string, number>,
  bySubcategory: Map<string, number>,
  subParent: Map<string, string>
): number {
  const catSet = new Set(categories);
  let total = 0;
  for (const c of categories) total = addMoney(total, byCategory.get(c) ?? 0);
  for (const s of subcategories) {
    const parent = subParent.get(s);
    if (parent && catSet.has(parent)) continue;
    total = addMoney(total, bySubcategory.get(s) ?? 0);
  }
  return total;
}

/** Referencias del editor: "cat:<uuid>" / "sub:<uuid>". */
export function linkRefs(row: BudgetLinkRow): string[] {
  const { categories, subcategories } = budgetLinks(row);
  return [...categories.map((id) => `cat:${id}`), ...subcategories.map((id) => `sub:${id}`)];
}

// ─── Metas (068) ─────────────────────────────────────────────────

export type GoalLinkRow = {
  /** Columnas de la 042, un solo vínculo. La 068 las copió a las listas y
   *  las dejó en NULL; se leen solo si no hay listas (base sin la 068). */
  ledger_fund_id?: string | null;
  ledger_category_id?: string | null;
  ledger_subcategory_id?: string | null;
  ledger_fund_ids?: string[] | null;
  ledger_category_ids?: string[] | null;
  ledger_subcategory_ids?: string[] | null;
};

export type GoalLinks = {
  /** Por RUBROS si hay alguna categoría o subcategoría; si no, por FONDOS.
   *  No se mezclan: un gasto en el fondo Y en la categoría se contaría dos
   *  veces, y con los totales agregados no hay cómo saberlo. */
  mode: "rubros" | "fondos" | "ninguno";
  funds: string[];
  categories: string[];
  subcategories: string[];
};

export function goalLinks(row: GoalLinkRow): GoalLinks {
  let funds = [...new Set(row.ledger_fund_ids ?? [])];
  let categories = [...new Set(row.ledger_category_ids ?? [])];
  let subcategories = [...new Set(row.ledger_subcategory_ids ?? [])];
  if (funds.length + categories.length + subcategories.length === 0) {
    // Vínculo único de la 042: manda el más específico.
    if (row.ledger_subcategory_id) subcategories = [row.ledger_subcategory_id];
    else if (row.ledger_category_id) categories = [row.ledger_category_id];
    else if (row.ledger_fund_id) funds = [row.ledger_fund_id];
  }
  const mode =
    categories.length + subcategories.length > 0
      ? "rubros"
      : funds.length > 0
        ? "fondos"
        : "ninguno";
  // En modo rubros los fondos no cuentan (el editor ya no deja elegirlos).
  if (mode === "rubros") funds = [];
  return { mode, funds, categories, subcategories };
}

export type LedgerTotals = {
  byFund: Map<string, number>;
  byCategory: Map<string, number>;
  bySubcategory: Map<string, number>;
};

/** Lo aplicado (meta de gasto) o recibido (meta de ingreso) con los
 *  rubros de la meta. `totals` es el juego que corresponde a la dirección. */
export function goalActual(
  row: GoalLinkRow,
  totals: LedgerTotals,
  subParent: Map<string, string>
): number {
  const l = goalLinks(row);
  if (l.mode === "rubros") {
    return sumRubros(l.categories, l.subcategories, totals.byCategory, totals.bySubcategory, subParent);
  }
  let total = 0;
  for (const f of l.funds) total = addMoney(total, totals.byFund.get(f) ?? 0);
  return total;
}

/** Referencias del editor de metas: "fund:" / "cat:" / "sub:". */
export function goalLinkRefs(row: GoalLinkRow): string[] {
  const l = goalLinks(row);
  return [
    ...l.funds.map((id) => `fund:${id}`),
    ...l.categories.map((id) => `cat:${id}`),
    ...l.subcategories.map((id) => `sub:${id}`),
  ];
}
