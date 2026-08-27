import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMoney } from "./treasury-format";

/**
 * Libro de Tesorería — capa de datos.
 *
 * El saldo NO se guarda: se calcula sumando movimientos. Y no es un
 * número sino una matriz cuenta × moneda, porque una misma caja puede
 * tener pesos y dólares. Ver supabase/migrations/040_treasury_ledger.sql.
 *
 * Todo lo de acá exige el tag `can_manage_treasury`: la RLS filtra las
 * filas, así que un admin sin el tag recibe listas vacías.
 */

export type TreasuryAccount = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export type TreasuryFund = TreasuryAccount;
export type TreasuryCategory = TreasuryAccount;

export type TreasurySubcategory = {
  id: string;
  name: string;
  category_id: string;
  default_fund_id: string | null;
  is_active: boolean;
  sort_order: number;
};

export type ContributorKind =
  | "persona"
  | "familia"
  | "negocio"
  | "colecta"
  | "otro";

export type TreasuryContributor = {
  id: string;
  name: string;
  kind: ContributorKind;
  profile_id: string | null;
  is_active: boolean;
};

export type TreasuryEntry = {
  id: string;
  entry_date: string;
  bahai_year: number | null;
  account_id: string;
  subcategory_id: string;
  category_id: string;
  fund_id: string | null;
  currency: "UYU" | "USD";
  amount: number;
  description: string | null;
  receipt_number: number | null;
  contributions_count: number;
  contributor_id: string | null;
  receipt_issued: boolean;
  transfer_group_id: string | null;
  is_opening_balance: boolean;
};

export type LedgerCatalog = {
  accounts: TreasuryAccount[];
  funds: TreasuryFund[];
  categories: TreasuryCategory[];
  subcategories: TreasurySubcategory[];
  contributors: TreasuryContributor[];
};

/** Zona horaria civil de la comunidad, igual que en lib/format.ts: la
 *  fecha por defecto del formulario tiene que ser el hoy de la comunidad,
 *  no el del servidor (Vercel corre en UTC). */
const TZ = process.env.APP_TIMEZONE || "America/Montevideo";

/** Hoy como "YYYY-MM-DD" en el huso de la comunidad. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function getLedgerCatalog(
  supabase: SupabaseClient
): Promise<LedgerCatalog> {
  const [accounts, funds, categories, subcategories, contributors] =
    await Promise.all([
      supabase
        .from("treasury_accounts")
        .select("id, name, is_active, sort_order")
        .order("sort_order"),
      supabase
        .from("treasury_funds")
        .select("id, name, is_active, sort_order")
        .order("sort_order"),
      supabase
        .from("treasury_categories")
        .select("id, name, is_active, sort_order")
        .order("sort_order"),
      supabase
        .from("treasury_subcategories")
        .select("id, name, category_id, default_fund_id, is_active, sort_order")
        .order("sort_order"),
      supabase
        .from("treasury_contributors")
        .select("id, name, kind, profile_id, is_active")
        .order("name"),
    ]);

  return {
    accounts: (accounts.data ?? []) as TreasuryAccount[],
    funds: (funds.data ?? []) as TreasuryFund[],
    categories: (categories.data ?? []) as TreasuryCategory[],
    subcategories: (subcategories.data ?? []) as TreasurySubcategory[],
    contributors: (contributors.data ?? []) as TreasuryContributor[],
  };
}

/** Años bahá'ís con movimientos, del más nuevo al más viejo. */
export async function getLedgerYears(
  supabase: SupabaseClient
): Promise<number[]> {
  const { data } = await supabase
    .from("treasury_entries")
    .select("bahai_year")
    .not("bahai_year", "is", null);
  const years = new Set<number>();
  for (const r of (data ?? []) as Array<{ bahai_year: number }>) {
    years.add(r.bahai_year);
  }
  return [...years].sort((a, b) => b - a);
}

export async function getLedgerEntries(
  supabase: SupabaseClient,
  year: number
): Promise<TreasuryEntry[]> {
  const { data } = await supabase
    .from("treasury_entries")
    .select(
      "id, entry_date, bahai_year, account_id, subcategory_id, category_id, fund_id, currency, amount, description, receipt_number, contributions_count, contributor_id, receipt_issued, transfer_group_id, is_opening_balance"
    )
    .eq("bahai_year", year)
    .order("entry_date", { ascending: false })
    .order("receipt_number", { ascending: false, nullsFirst: false });

  return ((data ?? []) as TreasuryEntry[]).map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));
}

export type BalanceRow = {
  key: string;
  label: string;
  currency: string;
  amount: number;
};

/** Agrupa saldos por una dimensión (cuenta o fondo) y moneda. */
export function balancesBy(
  entries: TreasuryEntry[],
  dimension: "account_id" | "fund_id",
  names: Map<string, string>,
  fallbackLabel = "Sin asignar"
): BalanceRow[] {
  const totals = new Map<string, BalanceRow>();
  for (const e of entries) {
    const id = e[dimension];
    const label = (id && names.get(id)) || fallbackLabel;
    const key = `${label}|${e.currency}`;
    const row = totals.get(key);
    if (row) {
      row.amount = addMoney(row.amount, e.amount);
    } else {
      totals.set(key, { key, label, currency: e.currency, amount: e.amount });
    }
  }
  return [...totals.values()].sort(
    (a, b) => a.label.localeCompare(b.label, "es") || a.currency.localeCompare(b.currency)
  );
}

/**
 * Totales de ingresos y gastos del período, por moneda.
 *
 * Dos clases de asiento NO son ingreso ni gasto del Fondo y van aparte:
 *
 *  · Los SALDOS DE APERTURA son arrastre del año anterior.
 *  · Las TRANSFERENCIAS (cambio de caja, compra de divisas) mueven la
 *    plata de lugar sin que entre ni salga nada. Contarlas infla las dos
 *    columnas por igual: un cambio de caja de $ 25.000 sumaba $ 25.000 a
 *    "Ingresos" y $ 25.000 a "Gastos". El saldo salía bien —se cancelan—
 *    pero el movimiento del año quedaba irreconocible. Van a `internal`,
 *    que suma cero por construcción y solo se muestra como referencia.
 *
 * Mismo criterio que el informe (lib/treasury-reports.ts): los dos leen
 * el mismo libro y tienen que decir lo mismo.
 */
export function periodTotals(entries: TreasuryEntry[]) {
  const byCurrency = new Map<
    string,
    {
      currency: string;
      income: number;
      expense: number;
      opening: number;
      internal: number;
      internalCount: number;
    }
  >();
  const groupsSeen = new Set<string>();
  for (const e of entries) {
    const row = byCurrency.get(e.currency) ?? {
      currency: e.currency,
      income: 0,
      expense: 0,
      opening: 0,
      internal: 0,
      internalCount: 0,
    };
    if (e.is_opening_balance) {
      row.opening = addMoney(row.opening, e.amount);
    } else if (e.transfer_group_id) {
      row.internal = addMoney(row.internal, e.amount);
      // Una transferencia son dos asientos: se cuenta la operación, no
      // las patas. Puede cruzar monedas, así que se cuenta en la moneda
      // de cada pata.
      if (!groupsSeen.has(`${e.transfer_group_id}|${e.currency}`)) {
        groupsSeen.add(`${e.transfer_group_id}|${e.currency}`);
        row.internalCount += 1;
      }
    } else if (e.amount > 0) {
      row.income = addMoney(row.income, e.amount);
    } else {
      row.expense = addMoney(row.expense, e.amount);
    }
    byCurrency.set(e.currency, row);
  }
  return [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency)
  );
}

/** Un movimiento con los nombres ya resueltos, para imprimir el recibo. */
export type ReceiptData = {
  id: string;
  entry_date: string;
  currency: string;
  amount: number;
  receipt_number: number | null;
  description: string | null;
  contributions_count: number;
  receipt_issued: boolean;
  receipt_issued_at: string | null;
  account_name: string | null;
  subcategory_name: string | null;
  fund_name: string | null;
  contributor_name: string | null;
};

type EmbeddedName = { name: string } | null;

/**
 * Trae un movimiento con los nombres resueltos en una sola consulta.
 * La RLS ya limita a la localidad del tesorero, así que no hace falta
 * filtrar por locality_id acá.
 */
export async function getEntryForReceipt(
  supabase: SupabaseClient,
  id: string
): Promise<ReceiptData | null> {
  const { data } = await supabase
    .from("treasury_entries")
    .select(
      `id, entry_date, currency, amount, receipt_number, description,
       contributions_count, receipt_issued, receipt_issued_at,
       account:treasury_accounts(name),
       subcategory:treasury_subcategories(name),
       fund:treasury_funds(name),
       contributor:treasury_contributors(name)`
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    id: string;
    entry_date: string;
    currency: string;
    amount: number | string;
    receipt_number: number | null;
    description: string | null;
    contributions_count: number;
    receipt_issued: boolean;
    receipt_issued_at: string | null;
    account: EmbeddedName;
    subcategory: EmbeddedName;
    fund: EmbeddedName;
    contributor: EmbeddedName;
  };

  return {
    id: row.id,
    entry_date: row.entry_date,
    currency: row.currency,
    amount: Number(row.amount),
    receipt_number: row.receipt_number,
    description: row.description,
    contributions_count: row.contributions_count,
    receipt_issued: row.receipt_issued,
    receipt_issued_at: row.receipt_issued_at,
    account_name: row.account?.name ?? null,
    subcategory_name: row.subcategory?.name ?? null,
    fund_name: row.fund?.name ?? null,
    contributor_name: row.contributor?.name ?? null,
  };
}
