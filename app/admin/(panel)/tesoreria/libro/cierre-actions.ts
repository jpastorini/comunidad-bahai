"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  buildCashbook,
  closingSnapshot,
  isValidMonthKey,
  monthLabel,
} from "@/lib/treasury-cashbook";
import {
  getCashbookEntries,
  getCashbookNames,
  getClosings,
  getFirstEntryMonth,
  lastClosedMonth,
  nextMonthToClose,
} from "@/lib/treasury-closings";
import { todayISO } from "@/lib/treasury-ledger";

type Result = { ok: boolean; error: string | null };
const ok: Result = { ok: true, error: null };
const fail = (error: string): Result => ({ ok: false, error });

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function revalidate() {
  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria/libro/cierres");
  revalidatePath("/admin/tesoreria");
}

/**
 * Cierra un mes civil. Solo el que corresponde en la secuencia (ver
 * nextMonthToClose): así el "saldo anterior" de cada hoja del Libro de
 * Caja es un número que ya nadie puede mover.
 *
 * Congela en `snapshot` los saldos por cuenta y moneda como evidencia.
 */
export async function closeMonthAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const month = str(formData, "month");
  if (!isValidMonthKey(month)) return fail("Mes inválido.");

  const [closings, firstMonth] = await Promise.all([
    getClosings(supabase),
    getFirstEntryMonth(supabase),
  ]);
  const expected = nextMonthToClose(closings, firstMonth, todayISO());
  if (!expected) {
    return fail("No hay ningún mes listo para cerrar: el mes en curso se cierra cuando termina.");
  }
  if (expected !== month) {
    return fail(`Los cierres son consecutivos: el próximo mes a cerrar es ${monthLabel(expected)}.`);
  }

  const [entries, names] = await Promise.all([
    getCashbookEntries(supabase, month),
    getCashbookNames(supabase),
  ]);
  const book = buildCashbook(entries, month, names);

  const { error } = await supabase.from("treasury_closings").insert({
    locality_id: session.locality.id,
    period_month: `${month}-01`,
    status: "closed",
    closed_by: session.user.id,
    snapshot: closingSnapshot(book),
    entries_count: book.entriesCount,
  });

  if (error) {
    if (error.code === "23505") return fail(`${monthLabel(month)} ya está cerrado.`);
    if (error.code === "42P01") return fail("Falta aplicar la migración 054 en Supabase.");
    return fail(error.message);
  }

  revalidate();
  return ok;
}

/**
 * Reabre el ÚLTIMO mes cerrado, con motivo. Existe porque antes de pegar
 * la hoja en el libro se descubren errores; después de pegada, la
 * corrección es un contra-asiento. El cierre no se borra: queda como
 * "reopened" con quién y por qué, y el mes se puede volver a cerrar.
 */
export async function reopenMonthAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const month = str(formData, "month");
  const reason = str(formData, "reason");
  if (!isValidMonthKey(month)) return fail("Mes inválido.");
  if (reason.length < 5) return fail("Escribí el motivo de la reapertura.");

  const closings = await getClosings(supabase);
  const last = lastClosedMonth(closings);
  if (!last) return fail("No hay meses cerrados.");
  if (last !== month) {
    return fail(`Solo se puede reabrir el último mes cerrado (${monthLabel(last)}).`);
  }

  const { error } = await supabase
    .from("treasury_closings")
    .update({
      status: "reopened",
      reopened_at: new Date().toISOString(),
      reopened_by: session.user.id,
      reopen_reason: reason.slice(0, 500),
    })
    .eq("period_month", `${month}-01`)
    .eq("status", "closed");

  if (error) return fail(error.message);

  revalidate();
  return ok;
}
