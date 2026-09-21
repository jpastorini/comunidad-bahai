"use server";

import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import {
  PLATFORM_LABELS,
  parseStatement,
  type ParsedStatement,
  type StatementPlatform,
} from "@/lib/bank-statements";
import { readStatementRows } from "@/lib/bank-statements-read";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_WINDOW_DAYS,
  reconcile,
  shiftDate,
  type ReconcileEntry,
  type ReconcileResult,
} from "@/lib/treasury-reconcile";

/**
 * Conciliación (primer paso): el extracto que exporta la plataforma contra
 * el libro de esa cuenta. NO guarda nada —ni el archivo ni el resultado—:
 * se compara y se muestra. Guardar las líneas, marcar el mes como
 * conciliado y "registrar en el libro" desde una línea son los pasos
 * siguientes, si este resulta útil.
 *
 * El archivo viaja dentro del form: un extracto de Prex pesa unos KB y el
 * techo de Vercel son 4,5 MB (ver CLAUDE.md, estatutos). Si algún día una
 * plataforma exporta algo pesado, va directo a Storage desde el cliente.
 *
 * Detrás del tag `can_manage_treasury`: la RLS del libro ya acota los
 * movimientos a la localidad del sombrero puesto, y la cuenta se verifica
 * contra esa misma localidad para que un id ajeno no devuelva nada.
 */

export type ReconcileActionResult =
  | {
      ok: true;
      fileName: string;
      platform: StatementPlatform;
      account: { id: string; name: string };
      statement: {
        lineCount: number;
        skipped: ParsedStatement["skipped"];
        warnings: string[];
      };
      result: ReconcileResult;
    }
  | { ok: false; error: string };

const MAX_BYTES = 2 * 1024 * 1024;

const fail = (error: string): ReconcileActionResult => ({ ok: false, error });

type UploadedFile = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

function isFile(v: unknown): v is UploadedFile {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    typeof (v as UploadedFile).arrayBuffer === "function"
  );
}

export async function reconcileAction(formData: FormData): Promise<ReconcileActionResult> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const accountId = ((formData.get("account_id") as string) || "").trim();
  if (!accountId) return fail("Elegí la cuenta del libro que corresponde al extracto.");

  const file = formData.get("file");
  if (!isFile(file) || file.size === 0) return fail("Elegí el archivo exportado de la plataforma.");
  if (file.size > MAX_BYTES) return fail("El archivo pesa más de 2 MB; un extracto no debería pesar tanto.");
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return fail("El archivo tiene que ser Excel (.xlsx o .xls) o CSV, tal como lo exporta la plataforma.");
  }

  const { data: account } = await supabase
    .from("treasury_accounts")
    .select("id, name")
    .eq("id", accountId)
    .eq("locality_id", session.locality.id)
    .maybeSingle();
  if (!account) return fail("Esa cuenta no es de esta comunidad.");

  let parsed: ReturnType<typeof parseStatement>;
  try {
    const rows = readStatementRows(Buffer.from(await file.arrayBuffer()));
    parsed = parseStatement(rows);
  } catch (e) {
    console.error("[reconcileAction] read", e);
    return fail("No pude leer el archivo. ¿Es el que exporta la plataforma, sin modificar?");
  }
  if ("error" in parsed) return fail(parsed.error);

  // Todo el libro de esa cuenta hasta unos días después del extracto: los
  // saldos son acumulados y los candidatos del borde pueden caer afuera.
  const upTo = shiftDate(parsed.to, DEFAULT_WINDOW_DAYS);
  const FIELDS =
    "id, entry_date, amount, currency, description, receipt_number, subcategory_id, transfer_group_id, is_opening_balance, voided_at";
  const first = await supabase
    .from("treasury_entries")
    .select(FIELDS)
    .eq("account_id", accountId)
    .lte("entry_date", upTo)
    .order("entry_date", { ascending: true });
  let rows: unknown[] | null = first.data as unknown[] | null;
  let error = first.error;
  if (error && error.code === "42703") {
    // Antes de la 054 no existe `voided_at`.
    const legacy = await supabase
      .from("treasury_entries")
      .select(FIELDS.replace(", voided_at", ""))
      .eq("account_id", accountId)
      .lte("entry_date", upTo)
      .order("entry_date", { ascending: true });
    rows = legacy.data as unknown[] | null;
    error = legacy.error;
  }
  if (error) {
    console.error("[reconcileAction] entries", error);
    return fail(`No pude leer el libro: ${error.message}`);
  }

  const { data: subs } = await supabase.from("treasury_subcategories").select("id, name");
  const rubroOf = new Map(((subs ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));

  type Row = Omit<ReconcileEntry, "rubro" | "voided_at"> & {
    subcategory_id: string;
    voided_at?: string | null;
  };
  const entries: ReconcileEntry[] = ((rows ?? []) as Row[]).map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    amount: Number(r.amount),
    currency: r.currency,
    description: r.description,
    receipt_number: r.receipt_number,
    rubro: rubroOf.get(r.subcategory_id) ?? null,
    transfer_group_id: r.transfer_group_id,
    is_opening_balance: r.is_opening_balance,
    voided_at: r.voided_at ?? null,
  }));

  const result = reconcile(parsed.lines, entries, {
    from: parsed.from,
    to: parsed.to,
    statementBalance: parsed.closingBalance,
  });

  // El error barato de esta pantalla es comparar el archivo contra la
  // cuenta equivocada (el del BROU contra "Cuenta Prex", o el de dólares
  // contra la de pesos): no se bloquea, porque los nombres del catálogo
  // son libres, pero se avisa arriba del resultado.
  const accountName = account.name as string;
  const warnings = [...parsed.warnings];
  const platformWord = { prex: /prex/i, brou: /brou/i, mercadopago: /mercado\s*pago|\bmp\b|point|pos\b/i }[
    parsed.platform
  ];
  if (!platformWord.test(accountName)) {
    warnings.unshift(
      `El archivo es de ${PLATFORM_LABELS[parsed.platform]} y la cuenta elegida es "${accountName}". ¿Es la cuenta correcta?`
    );
  }
  const statementCurrency = parsed.lines[0]?.currency;
  if (statementCurrency === "USD" && /peso/i.test(accountName)) {
    warnings.unshift(`El extracto está en dólares y la cuenta elegida es "${accountName}".`);
  } else if (statementCurrency === "UYU" && /d[oó]lar|usd/i.test(accountName)) {
    warnings.unshift(`El extracto está en pesos y la cuenta elegida es "${accountName}".`);
  }

  return {
    ok: true,
    fileName: file.name,
    platform: parsed.platform,
    account: { id: account.id as string, name: accountName },
    statement: {
      lineCount: parsed.lines.length,
      skipped: parsed.skipped,
      warnings,
    },
    result,
  };
}
