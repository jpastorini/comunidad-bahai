import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetLinks, goalLinks, type BudgetLinkRow, type GoalLinkRow } from "./budget-links";
import type {
  TreasuryAccount,
  TreasuryCategory,
  TreasuryFund,
  TreasurySubcategory,
} from "./treasury-ledger";

/**
 * El catálogo del libro (cuentas, fondos, categorías y subcategorías) y
 * cuánto se usa cada cosa. Lo lee la pantalla Tesorería → Catálogo, que
 * es donde el tesorero agrega, renombra, ordena y da de baja.
 *
 * La regla de "quitar" vive acá y en los actions, no en la UI: lo que
 * nunca se usó se ELIMINA; lo que ya aparece en un movimiento, una línea
 * de presupuesto, una meta o una subcategoría se DESACTIVA (deja de
 * ofrecerse al cargar, el historial lo sigue mostrando). Las FK del
 * libro son `on delete restrict` para movimientos y subcategorías, así
 * que la base frena un borrado que se nos escape; el conteo existe para
 * que la pantalla ofrezca la acción correcta de entrada y no un error.
 */

export type CatalogKind = "account" | "fund" | "category" | "subcategory";

export const CATALOG_KINDS: CatalogKind[] = ["account", "fund", "category", "subcategory"];

export const CATALOG_TABLE: Record<CatalogKind, string> = {
  account: "treasury_accounts",
  fund: "treasury_funds",
  category: "treasury_categories",
  subcategory: "treasury_subcategories",
};

export const CATALOG_LABEL: Record<
  CatalogKind,
  { one: string; many: string; una: "una" | "un"; inactive: string }
> = {
  account: { one: "cuenta", many: "cuentas", una: "una", inactive: "Inactiva" },
  fund: { one: "fondo", many: "fondos", una: "un", inactive: "Inactivo" },
  category: { one: "categoría", many: "categorías", una: "una", inactive: "Inactiva" },
  subcategory: { one: "subcategoría", many: "subcategorías", una: "una", inactive: "Inactiva" },
};

export function isCatalogKind(v: string): v is CatalogKind {
  return (CATALOG_KINDS as string[]).includes(v);
}

export type CatalogUsage = {
  /** Movimientos del libro que lo referencian (anulados incluidos: el
   *  anulado sigue siendo una fila con historia). */
  entries: number;
  /** Líneas de presupuesto vinculadas ("Se ejecuta con"). */
  budget: number;
  /** Metas de Tesorería vinculadas. */
  goals: number;
  /** Subcategorías: las de una categoría, o las que sugieren un fondo. */
  children: number;
};

export const EMPTY_USAGE: CatalogUsage = { entries: 0, budget: 0, goals: 0, children: 0 };

export function usageTotal(u: CatalogUsage | undefined): number {
  if (!u) return 0;
  return u.entries + u.budget + u.goals + u.children;
}

/** Sin uso en ningún lado: se puede eliminar. Con uso: se desactiva. */
export function canDelete(u: CatalogUsage | undefined): boolean {
  return usageTotal(u) === 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "12 movimientos · 2 subcategorías", o "Sin uso todavía". */
export function usageLabel(u: CatalogUsage | undefined, kind: CatalogKind): string {
  if (!u) return "Sin uso todavía";
  const parts: string[] = [];
  if (u.entries) parts.push(plural(u.entries, "movimiento", "movimientos"));
  if (u.children) {
    const subs = plural(u.children, "subcategoría", "subcategorías");
    parts.push(kind === "fund" ? `sugerido en ${subs}` : subs);
  }
  if (u.budget) parts.push(plural(u.budget, "línea de presupuesto", "líneas de presupuesto"));
  if (u.goals) parts.push(plural(u.goals, "meta", "metas"));
  return parts.length ? parts.join(" · ") : "Sin uso todavía";
}

export type TreasuryCatalog = {
  accounts: TreasuryAccount[];
  funds: TreasuryFund[];
  categories: TreasuryCategory[];
  subcategories: TreasurySubcategory[];
  /** Uso por id, para las cuatro listas juntas. */
  usage: Record<string, CatalogUsage>;
};

function bump(
  usage: Record<string, CatalogUsage>,
  id: string | null | undefined,
  key: keyof CatalogUsage
) {
  if (!id) return;
  const u = usage[id] ?? (usage[id] = { ...EMPTY_USAGE });
  u[key] += 1;
}

/** PostgREST corta en mil filas por pedido; el libro las pasa en unos
 *  años. Se pagina hasta que venga una página corta. */
const PAGE = 1000;

/**
 * Cuánto se usa cada ítem del catálogo, por id. Se cuenta con la RLS de
 * quien pregunta (el tesorero ve su libro), acotado además a la
 * localidad porque el admin nacional lee todas: sus filas apuntarían a
 * ids de otros catálogos y no harían daño, pero paginarlas cuesta.
 */
export async function getCatalogUsage(
  supabase: SupabaseClient,
  localityId: string
): Promise<Record<string, CatalogUsage>> {
  const usage: Record<string, CatalogUsage> = {};

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("treasury_entries")
      .select("account_id, subcategory_id, category_id, fund_id")
      .eq("locality_id", localityId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[getCatalogUsage] entries", error);
      break;
    }
    const rows = (data ?? []) as {
      account_id: string;
      subcategory_id: string;
      category_id: string;
      fund_id: string | null;
    }[];
    for (const r of rows) {
      bump(usage, r.account_id, "entries");
      bump(usage, r.subcategory_id, "entries");
      bump(usage, r.category_id, "entries");
      bump(usage, r.fund_id, "entries");
    }
    if (rows.length < PAGE) break;
  }

  const [subs, budget, goals] = await Promise.all([
    supabase
      .from("treasury_subcategories")
      .select("category_id, default_fund_id")
      .eq("locality_id", localityId),
    supabase
      .from("treasury_budget_items")
      // "*": con o sin la 067 (listas de rubros), budgetLinks() lee lo que haya.
      .select("*"),
    supabase
      .from("treasury_goals")
      // "*": con o sin la 068 (listas de rubros), goalLinks() lee lo que haya.
      .select("*")
      .eq("locality_id", localityId),
  ]);

  for (const s of (subs.data ?? []) as { category_id: string; default_fund_id: string | null }[]) {
    bump(usage, s.category_id, "children");
    bump(usage, s.default_fund_id, "children");
  }
  // El presupuesto y las metas pueden no existir en una base vieja; un
  // error acá solo deja el conteo en cero y la FK `set null` no frena
  // nada, así que se loguea y se sigue.
  if (budget.error) console.warn("[getCatalogUsage] budget", budget.error.message);
  for (const b of (budget.data ?? []) as BudgetLinkRow[]) {
    const links = budgetLinks(b);
    for (const id of links.categories) bump(usage, id, "budget");
    for (const id of links.subcategories) bump(usage, id, "budget");
  }
  if (goals.error) console.warn("[getCatalogUsage] goals", goals.error.message);
  for (const g of (goals.data ?? []) as GoalLinkRow[]) {
    const links = goalLinks(g);
    for (const id of [...links.funds, ...links.categories, ...links.subcategories]) {
      bump(usage, id, "goals");
    }
  }

  return usage;
}

/** Las cuatro listas de la localidad, activas e inactivas, con su uso. */
export async function getTreasuryCatalog(
  supabase: SupabaseClient,
  localityId: string
): Promise<TreasuryCatalog> {
  const [accounts, funds, categories, subcategories, usage] = await Promise.all([
    supabase
      .from(CATALOG_TABLE.account)
      .select("id, name, is_active, sort_order")
      .eq("locality_id", localityId)
      .order("sort_order")
      .order("name"),
    supabase
      .from(CATALOG_TABLE.fund)
      .select("id, name, is_active, sort_order")
      .eq("locality_id", localityId)
      .order("sort_order")
      .order("name"),
    supabase
      .from(CATALOG_TABLE.category)
      .select("id, name, is_active, sort_order")
      .eq("locality_id", localityId)
      .order("sort_order")
      .order("name"),
    supabase
      .from(CATALOG_TABLE.subcategory)
      .select("id, name, category_id, default_fund_id, is_active, sort_order")
      .eq("locality_id", localityId)
      .order("sort_order")
      .order("name"),
    getCatalogUsage(supabase, localityId),
  ]);

  return {
    accounts: (accounts.data ?? []) as TreasuryAccount[],
    funds: (funds.data ?? []) as TreasuryFund[],
    categories: (categories.data ?? []) as TreasuryCategory[],
    subcategories: (subcategories.data ?? []) as TreasurySubcategory[],
    usage,
  };
}
