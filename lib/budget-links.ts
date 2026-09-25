import { addMoney } from "./treasury-format";

/**
 * Con qué rubros del libro se ejecuta una línea del presupuesto (067).
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
  const catSet = new Set(categories);
  let total = 0;
  for (const c of categories) total = addMoney(total, spentByCategory.get(c) ?? 0);
  for (const s of subcategories) {
    const parent = subParent.get(s);
    if (parent && catSet.has(parent)) continue;
    total = addMoney(total, spentBySubcategory.get(s) ?? 0);
  }
  return total;
}

/** Referencias del editor: "cat:<uuid>" / "sub:<uuid>". */
export function linkRefs(row: BudgetLinkRow): string[] {
  const { categories, subcategories } = budgetLinks(row);
  return [...categories.map((id) => `cat:${id}`), ...subcategories.map((id) => `sub:${id}`)];
}
