"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import {
  PLATFORM_LABELS,
  assignFingerprints,
  parseStatement,
  type StatementPlatform,
} from "@/lib/bank-statements";
import { readStatementRows } from "@/lib/bank-statements-read";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatReceiptDate } from "@/lib/treasury-format";
import {
  DEFAULT_WINDOW_DAYS,
  reconcile,
  shiftDate,
} from "@/lib/treasury-reconcile";
import {
  STATEMENTS_BUCKET,
  getAccountEntries,
  getMatches,
  getRubroNames,
  getStoredLines,
  isStatementsSchemaMissing,
  toStatementLine,
} from "@/lib/treasury-statements";

/**
 * Conciliación (061): importar un extracto, y las cuatro acciones sobre
 * lo que el motor no resolvió solo.
 *
 * Importar hace, en orden: parsear el archivo · calcular la huella de cada
 * línea y descartar las ya conocidas (eBROU exporta los últimos 20
 * movimientos, cada archivo se superpone con el anterior) · guardar el
 * archivo original en el bucket privado `extractos` · crear la
 * importación y sus líneas nuevas · correr el motor sobre TODAS las
 * líneas pendientes de la cuenta (no solo las nuevas: un movimiento
 * cargado hoy puede cerrar una línea importada hace dos semanas) contra
 * los movimientos sin par, y guardar los pares con `matched_by =
 * 'motor'`. Las salidas devueltas por la plataforma quedan descartadas
 * en automático, con motivo.
 *
 * El archivo viaja dentro del form: un extracto pesa unos KB y el techo
 * de Vercel son 4,5 MB (ver CLAUDE.md, estatutos). Si una plataforma
 * exportara algo pesado, va directo a Storage desde el cliente.
 *
 * Detrás del tag `can_manage_treasury`: la RLS de las tres tablas acota
 * a la localidad del sombrero puesto; la cuenta se verifica contra esa
 * misma localidad para que un id ajeno no devuelva nada.
 */

export type ImportResult =
  | {
      ok: true;
      platform: StatementPlatform;
      total: number;
      newCount: number;
      knownCount: number;
      matchedCount: number;
      dismissedCount: number;
      warnings: string[];
    }
  | { ok: false; error: string };

export type Result = { ok: boolean; error: string | null };

const MAX_BYTES = 2 * 1024 * 1024;
const MIGRATION_MSG = "Falta aplicar la migración 061 (conciliación con el extracto).";

const okResult: Result = { ok: true, error: null };
const failResult = (error: string): Result => ({ ok: false, error });
const failImport = (error: string): ImportResult => ({ ok: false, error });

type UploadedFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function isFile(v: unknown): v is UploadedFile {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    typeof (v as UploadedFile).arrayBuffer === "function"
  );
}

const MIME_BY_EXT: Record<string, string> = {
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

async function guard() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  return { session, supabase: createSupabaseServer() };
}

function revalidateAll() {
  revalidatePath("/admin/tesoreria/conciliacion");
  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria/libro/cierres");
}

// ─── Importar ──────────────────────────────────────────────────────────

export async function importStatementAction(formData: FormData): Promise<ImportResult> {
  const { session, supabase } = await guard();

  const accountId = ((formData.get("account_id") as string) || "").trim();
  if (!accountId) return failImport("Elegí la cuenta del libro que corresponde al extracto.");

  const file = formData.get("file");
  if (!isFile(file) || file.size === 0) return failImport("Elegí el archivo exportado de la plataforma.");
  if (file.size > MAX_BYTES) return failImport("El archivo pesa más de 2 MB; un extracto no debería pesar tanto.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!MIME_BY_EXT[ext]) {
    return failImport("El archivo tiene que ser Excel (.xlsx o .xls) o CSV, tal como lo exporta la plataforma.");
  }

  const { data: account } = await supabase
    .from("treasury_accounts")
    .select("id, name")
    .eq("id", accountId)
    .eq("locality_id", session.locality.id)
    .maybeSingle();
  if (!account) return failImport("Esa cuenta no es de esta comunidad.");
  const accountName = account.name as string;

  // 1. Parsear.
  let buffer: Buffer;
  let parsed: ReturnType<typeof parseStatement>;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseStatement(readStatementRows(buffer));
  } catch (e) {
    console.error("[importStatementAction] read", e);
    return failImport("No pude leer el archivo. ¿Es el que exporta la plataforma, sin modificar?");
  }
  if ("error" in parsed) return failImport(parsed.error);

  const warnings = [...parsed.warnings];
  const platformWord = { prex: /prex/i, brou: /brou/i, mercadopago: /mercado\s*pago|\bmp\b|point|pos\b/i }[
    parsed.platform
  ];
  if (!platformWord.test(accountName)) {
    warnings.unshift(
      `El archivo es de ${PLATFORM_LABELS[parsed.platform]} y la cuenta elegida es "${accountName}". Si no es la cuenta correcta, borrá la importación y volvé a subirlo.`
    );
  }
  const statementCurrency = parsed.lines[0]?.currency ?? "UYU";
  if (statementCurrency === "USD" && /peso/i.test(accountName)) {
    warnings.unshift(`El extracto está en dólares y la cuenta elegida es "${accountName}".`);
  } else if (statementCurrency === "UYU" && /d[oó]lar|usd/i.test(accountName)) {
    warnings.unshift(`El extracto está en pesos y la cuenta elegida es "${accountName}".`);
  }

  // 2. Huellas: qué líneas ya estaban.
  const fingerprints = assignFingerprints(parsed.lines);
  const { data: existingRows, error: existingError } = await supabase
    .from("treasury_statement_lines")
    .select("fingerprint")
    .eq("account_id", accountId)
    .in("fingerprint", [...fingerprints.values()]);
  if (existingError) {
    if (isStatementsSchemaMissing(existingError)) return failImport(MIGRATION_MSG);
    console.error("[importStatementAction] existing", existingError);
    return failImport(`No pude leer las líneas ya importadas: ${existingError.message}`);
  }
  const known = new Set(((existingRows ?? []) as Array<{ fingerprint: string }>).map((r) => r.fingerprint));
  const newLines = parsed.lines.filter((l) => !known.has(fingerprints.get(l.key)!));

  // 3. El archivo original, como evidencia. Si el bucket falla, la
  //    importación sigue sin archivo y se avisa: las líneas valen igual.
  let storagePath: string | null = `${session.locality.id}/${accountId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STATEMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: MIME_BY_EXT[ext], upsert: false });
  if (uploadError) {
    console.error("[importStatementAction] storage", uploadError);
    warnings.push(`No se pudo guardar el archivo original (${uploadError.message}); las líneas se importaron igual.`);
    storagePath = null;
  }

  // 4. La importación y sus líneas nuevas.
  const { data: imp, error: importError } = await supabase
    .from("treasury_statement_imports")
    .insert({
      locality_id: session.locality.id,
      account_id: accountId,
      platform: parsed.platform,
      file_name: file.name,
      storage_path: storagePath,
      period_from: parsed.from,
      period_to: parsed.to,
      currency: statementCurrency,
      closing_balance: parsed.closingBalance?.amount ?? null,
      closing_balance_as_of: parsed.closingBalance?.asOf ?? null,
      lines_count: parsed.lines.length,
      new_lines_count: newLines.length,
      imported_by: session.user.id,
    })
    .select("id")
    .single();
  if (importError || !imp) {
    console.error("[importStatementAction] import", importError);
    if (storagePath) await supabase.storage.from(STATEMENTS_BUCKET).remove([storagePath]);
    if (isStatementsSchemaMissing(importError)) return failImport(MIGRATION_MSG);
    return failImport(`No pude registrar la importación: ${importError?.message ?? "error"}`);
  }
  const importId = imp.id as string;

  if (newLines.length > 0) {
    const { error: linesError } = await supabase.from("treasury_statement_lines").insert(
      newLines.map((l) => ({
        locality_id: session.locality.id,
        account_id: accountId,
        import_id: importId,
        platform: parsed.platform,
        fingerprint: fingerprints.get(l.key)!,
        line_date: l.date,
        amount: l.amount,
        currency: l.currency,
        description: l.description,
        memo: l.memo,
        reference: l.reference,
        gross_amount: l.grossAmount,
      }))
    );
    if (linesError) {
      console.error("[importStatementAction] lines", linesError);
      await supabase.from("treasury_statement_imports").delete().eq("id", importId);
      if (storagePath) await supabase.storage.from(STATEMENTS_BUCKET).remove([storagePath]);
      return failImport(`No pude guardar las líneas: ${linesError.message}`);
    }
  }

  // 5. El motor, sobre todo lo pendiente de la cuenta.
  const { matchedCount, dismissedCount, error: matchError } = await runMatcher(
    supabase,
    accountId,
    session.user.id
  );
  if (matchError) warnings.push(matchError);

  revalidateAll();
  return {
    ok: true,
    platform: parsed.platform,
    total: parsed.lines.length,
    newCount: newLines.length,
    knownCount: parsed.lines.length - newLines.length,
    matchedCount,
    dismissedCount,
    warnings,
  };
}

/**
 * Corre el motor sobre las líneas pendientes de la cuenta contra los
 * movimientos sin par, y persiste lo que encuentra. Devuelve cuántas
 * líneas cerraron y cuántas se descartaron solas.
 */
async function runMatcher(
  supabase: ReturnType<typeof createSupabaseServer>,
  accountId: string,
  userId: string
): Promise<{ matchedCount: number; dismissedCount: number; error: string | null }> {
  const stored = await getStoredLines(supabase, accountId);
  const matches = await getMatches(supabase, stored.map((l) => l.id));
  const matchedLineIds = new Set(matches.map((m) => m.line_id));
  const matchedEntryIds = new Set(matches.map((m) => m.entry_id));

  const pending = stored.filter((l) => !matchedLineIds.has(l.id) && !l.dismissed_at);
  if (pending.length === 0) return { matchedCount: 0, dismissedCount: 0, error: null };

  const lines = pending.map(toStatementLine);
  const from = lines.reduce((a, l) => (l.date < a ? l.date : a), lines[0].date);
  const to = lines.reduce((a, l) => (l.date > a ? l.date : a), lines[0].date);

  const rubroOf = await getRubroNames(supabase);
  const { entries, error } = await getAccountEntries(
    supabase,
    accountId,
    shiftDate(to, DEFAULT_WINDOW_DAYS),
    rubroOf
  );
  if (error) return { matchedCount: 0, dismissedCount: 0, error: `El motor no pudo leer el libro: ${error}` };

  const result = reconcile(
    lines,
    entries.filter((e) => !matchedEntryIds.has(e.id)),
    { from, to }
  );

  let matchedCount = 0;
  if (result.matched.length > 0) {
    const rows = result.matched.flatMap((m) =>
      m.entries.map((e) => ({
        line_id: m.line.key,
        entry_id: e.id,
        kind: m.kind,
        matched_by: "motor",
        matched_by_user: userId,
      }))
    );
    const { error: insertError } = await supabase.from("treasury_statement_matches").insert(rows);
    if (insertError) {
      console.error("[runMatcher] matches", insertError);
      return { matchedCount: 0, dismissedCount: 0, error: `No pude guardar los pares: ${insertError.message}` };
    }
    matchedCount = result.matched.length;
  }

  let dismissedCount = 0;
  for (const pair of result.reversed) {
    const now = new Date().toISOString();
    const updates = [
      {
        id: pair.out.key,
        reason: `Devuelta por la plataforma el ${formatReceiptDate(pair.back.date)} (${pair.back.description || "devolución"}).`,
      },
      {
        id: pair.back.key,
        reason: `Devolución de la salida del ${formatReceiptDate(pair.out.date)} (${pair.out.description || "salida"}).`,
      },
    ];
    for (const u of updates) {
      const { error: dismissError } = await supabase
        .from("treasury_statement_lines")
        .update({ dismissed_at: now, dismissed_by: userId, dismiss_reason: u.reason, dismissed_auto: true })
        .eq("id", u.id);
      if (!dismissError) dismissedCount++;
    }
  }

  return { matchedCount, dismissedCount, error: null };
}

// ─── Lo que el tesorero resuelve a mano ────────────────────────────────

/** Une una línea con un movimiento del libro elegido a mano. Se puede
 *  llamar más de una vez sobre la misma línea (comisión + transferencia). */
export async function linkLineAction(lineId: string, entryId: string): Promise<Result> {
  const { session, supabase } = await guard();

  const { data: line, error: lineError } = await supabase
    .from("treasury_statement_lines")
    .select("id, account_id, currency, dismissed_at")
    .eq("id", lineId)
    .maybeSingle();
  if (lineError) return failResult(isStatementsSchemaMissing(lineError) ? MIGRATION_MSG : lineError.message);
  if (!line) return failResult("Esa línea no existe.");

  const { data: entry } = await supabase
    .from("treasury_entries")
    .select("id, account_id, currency, voided_at, is_opening_balance")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return failResult("Ese movimiento no existe.");
  if (entry.account_id !== line.account_id) return failResult("El movimiento es de otra cuenta.");
  if (entry.currency !== line.currency) return failResult("El movimiento está en otra moneda.");
  if (entry.voided_at) return failResult("Un movimiento anulado no cierra contra el banco.");
  if (entry.is_opening_balance) return failResult("Un saldo de apertura no es un movimiento del banco.");

  const { error } = await supabase.from("treasury_statement_matches").insert({
    line_id: lineId,
    entry_id: entryId,
    kind: "manual",
    matched_by: "tesorero",
    matched_by_user: session.user.id,
  });
  if (error) {
    if (error.code === "23505") return failResult("Ese movimiento ya está vinculado a otra línea.");
    console.error("[linkLineAction]", error);
    return failResult(error.message);
  }
  if (line.dismissed_at) {
    await supabase
      .from("treasury_statement_lines")
      .update({ dismissed_at: null, dismissed_by: null, dismiss_reason: null, dismissed_auto: false })
      .eq("id", lineId);
  }
  revalidateAll();
  return okResult;
}

/** La línea no le corresponde al libro: transferencia devuelta, movimiento
 *  de otra cuenta, algo que el banco corrigió después. Con motivo. */
export async function dismissLineAction(lineId: string, reason: string): Promise<Result> {
  const { session, supabase } = await guard();
  const text = (reason || "").trim();
  if (text.length < 3) return failResult("Decí por qué no corresponde al libro.");

  const matches = await getMatches(supabase, [lineId]);
  if (matches.length > 0) return failResult("La línea tiene movimientos vinculados: primero deshacé el vínculo.");

  const { error } = await supabase
    .from("treasury_statement_lines")
    .update({
      dismissed_at: new Date().toISOString(),
      dismissed_by: session.user.id,
      dismiss_reason: text.slice(0, 300),
      dismissed_auto: false,
    })
    .eq("id", lineId);
  if (error) {
    console.error("[dismissLineAction]", error);
    return failResult(isStatementsSchemaMissing(error) ? MIGRATION_MSG : error.message);
  }
  revalidateAll();
  return okResult;
}

/** Vuelve la línea a pendiente: suelta sus pares y borra el descarte. */
export async function undoLineAction(lineId: string): Promise<Result> {
  const { supabase } = await guard();
  const { error: matchError } = await supabase
    .from("treasury_statement_matches")
    .delete()
    .eq("line_id", lineId);
  if (matchError) {
    console.error("[undoLineAction] matches", matchError);
    return failResult(isStatementsSchemaMissing(matchError) ? MIGRATION_MSG : matchError.message);
  }
  const { error } = await supabase
    .from("treasury_statement_lines")
    .update({ dismissed_at: null, dismissed_by: null, dismiss_reason: null, dismissed_auto: false })
    .eq("id", lineId);
  if (error) {
    console.error("[undoLineAction] line", error);
    return failResult(error.message);
  }
  revalidateAll();
  return okResult;
}

/** Borra una importación con sus líneas y sus pares. Es para el archivo
 *  subido a la cuenta equivocada; se vuelve a importar. */
export async function deleteImportAction(importId: string): Promise<Result> {
  const { supabase } = await guard();
  const { data: imp, error: readError } = await supabase
    .from("treasury_statement_imports")
    .select("id, storage_path")
    .eq("id", importId)
    .maybeSingle();
  if (readError) return failResult(isStatementsSchemaMissing(readError) ? MIGRATION_MSG : readError.message);
  if (!imp) return failResult("Esa importación no existe.");

  if (imp.storage_path) {
    const { error: removeError } = await supabase.storage
      .from(STATEMENTS_BUCKET)
      .remove([imp.storage_path as string]);
    if (removeError) console.error("[deleteImportAction] storage", removeError);
  }
  const { error } = await supabase.from("treasury_statement_imports").delete().eq("id", importId);
  if (error) {
    console.error("[deleteImportAction]", error);
    return failResult(error.message);
  }
  revalidateAll();
  return okResult;
}
