import type { SupabaseClient } from "@supabase/supabase-js";
import { addMoney } from "./treasury-format";
import { treasuryYearEnd, treasuryYearStart } from "./treasury-year";
import type { Balance, ImportWarning, LedgerContext, OpeningCheck, OpeningsMode } from "./ledger-import";

/**
 * Lo que la importación de ejercicios anteriores persiste (062): el lote
 * y lo que hace falta para armarle el contexto al planificador.
 *
 * Server-only (hace queries). Los tipos se importan desde el cliente con
 * `import type`, igual que en `treasury-statements.ts`.
 */

export const LEDGER_IMPORTS_BUCKET = "planillas";

export type LedgerImport = {
  id: string;
  bahai_year: number;
  file_name: string;
  storage_path: string | null;
  entries_count: number;
  openings_mode: OpeningsMode;
  openings: OpeningCheck[];
  warnings: ImportWarning[];
  note: string | null;
  created_at: string;
};

const IMPORT_FIELDS =
  "id, bahai_year, file_name, storage_path, entries_count, openings_mode, openings, warnings, note, created_at";

/** Códigos de "todavía no corrió la 062". */
export function isLedgerImportSchemaMissing(
  error: { code?: string } | null | undefined
): boolean {
  return !!error && (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205");
}

export async function getLedgerImports(
  supabase: SupabaseClient
): Promise<{ rows: LedgerImport[]; missing: boolean }> {
  const { data, error } = await supabase
    .from("treasury_ledger_imports")
    .select(IMPORT_FIELDS)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isLedgerImportSchemaMissing(error)) console.error("[getLedgerImports]", error);
    return { rows: [], missing: isLedgerImportSchemaMissing(error) };
  }
  return { rows: (data ?? []) as LedgerImport[], missing: false };
}

type NamedRow = { id: string; name: string };

/**
 * El contexto que necesita `planImport()`: el catálogo tal cual está hoy,
 * los recibos ya usados, y el cierre del libro al día anterior al inicio
 * del ejercicio que se va a importar.
 *
 * ⚠️ El catálogo se trae COMPLETO, activos e inactivos. Una planilla de
 * hace cinco años usa rubros que hoy están dados de baja; si solo
 * miráramos los activos, el import los crearía de nuevo y el historial de
 * ese rubro quedaría partido en dos para siempre.
 */
export async function buildLedgerContext(
  supabase: SupabaseClient,
  localityId: string,
  bahaiYear: number
): Promise<LedgerContext> {
  const yearStart = treasuryYearStart(bahaiYear);
  const yearEnd = treasuryYearEnd(bahaiYear);

  const [accounts, funds, categories, subcategories, contributors, receipts, prior] =
    await Promise.all([
      supabase.from("treasury_accounts").select("id, name").eq("locality_id", localityId),
      supabase.from("treasury_funds").select("id, name").eq("locality_id", localityId),
      supabase.from("treasury_categories").select("id, name").eq("locality_id", localityId),
      supabase.from("treasury_subcategories").select("id, name").eq("locality_id", localityId),
      supabase.from("treasury_contributors").select("id, name").eq("locality_id", localityId),
      supabase
        .from("treasury_entries")
        .select("receipt_number")
        .eq("locality_id", localityId)
        .not("receipt_number", "is", null),
      yearStart
        ? supabase
            .from("treasury_entries")
            .select("account_id, currency, amount")
            .eq("locality_id", localityId)
            .is("voided_at", null)
            .lt("entry_date", yearStart)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const names = (res: { data: unknown }) => ((res.data ?? []) as NamedRow[]).map((r) => r.name);
  const accountName = new Map(
    ((accounts.data ?? []) as NamedRow[]).map((a) => [a.id, a.name] as const)
  );

  // Cierre del ejercicio anterior, por cuenta y moneda. Es contra esto
  // que se compara el "Saldo anterior" que declara la planilla.
  const balances = new Map<string, Balance>();
  for (const row of (prior.data ?? []) as Array<{
    account_id: string;
    currency: "UYU" | "USD";
    amount: number | string;
  }>) {
    const k = `${row.account_id}|${row.currency}`;
    const b = balances.get(k) ?? {
      account: accountName.get(row.account_id) ?? "Cuenta",
      currency: row.currency,
      amount: 0,
    };
    b.amount = addMoney(b.amount, Number(row.amount));
    balances.set(k, b);
  }

  return {
    bahaiYear,
    yearStart,
    yearEnd,
    accounts: names(accounts),
    funds: names(funds),
    categories: names(categories),
    subcategories: names(subcategories),
    contributors: names(contributors),
    usedReceipts: ((receipts.data ?? []) as Array<{ receipt_number: number }>).map(
      (r) => r.receipt_number
    ),
    // Una cuenta que cerró en cero no aporta nada a la comparación, pero
    // SÍ cuenta para decidir si el libro arranca acá: si hay movimientos
    // anteriores, la apertura de esta planilla se verifica, no se importa.
    priorBalances: [...balances.values()],
  };
}
