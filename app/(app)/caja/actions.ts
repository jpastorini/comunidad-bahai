"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireBahai } from "@/lib/auth";
import { getChatAdminIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import {
  MAX_ATTACHMENT_BYTES,
  RECEIPTS_BUCKET,
  isAcceptedAttachment,
} from "@/lib/treasury-attachments";
import {
  expectedCash,
  getCashBox,
  getCashBoxBalance,
  getCashLines,
  getCashReport,
  isCashSchemaMissing,
  linesTotal,
} from "@/lib/treasury-cash";
import { formatMoney, parseMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";

/**
 * "Mi caja chica" (074), lado del responsable: cargar un gasto con su
 * comprobante, sacarlo, y enviar la rendición con el arqueo.
 *
 * El responsable no tiene el tag de Tesorería. Todo lo que escribe pasa
 * por la RLS de la 074: su caja, sus rendiciones en borrador o devueltas,
 * y la carpeta <locality>/caja/<box>/ del bucket. Acá se valida en
 * palabras lo que la base rechazaría igual.
 */

type Result = { ok: boolean; error: string | null };
const ok: Result = { ok: true, error: null };
const fail = (error: string): Result => ({ ok: false, error });

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function extensionFor(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  const fromName = file.name.split(".").pop() ?? "";
  const fromMime = file.type.split("/")[1] ?? "";
  return (fromName || fromMime).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
}

/** La rendición abierta de la caja (borrador o devuelta), creándola si no hay. */
async function openReportFor(
  supabase: ReturnType<typeof createSupabaseServer>,
  box: { id: string; locality_id: string },
  userId: string
): Promise<{ id: string; status: string } | null> {
  const { data } = await supabase
    .from("treasury_cash_reports")
    .select("id, status")
    .eq("box_id", box.id)
    .in("status", ["borrador", "devuelta"])
    .maybeSingle();
  if (data) return data as { id: string; status: string };
  const { data: created, error } = await supabase
    .from("treasury_cash_reports")
    .insert({ box_id: box.id, locality_id: box.locality_id, status: "borrador", created_by: userId })
    .select("id, status")
    .single();
  if (error) {
    console.error("[openReportFor]", error);
    return null;
  }
  return created as { id: string; status: string };
}

export async function addCashLineAction(formData: FormData): Promise<Result> {
  const session = await requireBahai("/caja");
  const supabase = createSupabaseServer();

  const boxId = str(formData, "box_id");
  const box = boxId ? await getCashBox(supabase, boxId) : null;
  if (!box || box.holder_profile_id !== session.user.id) return fail("Esa caja no es tuya.");
  if (!box.is_active) return fail("La caja está desactivada.");

  const lineDate = str(formData, "line_date");
  const currency = str(formData, "currency") || "UYU";
  const amount = parseMoney(str(formData, "amount"));
  const subcategoryId = str(formData, "subcategory_id");
  const description = str(formData, "description").slice(0, 300);
  const file = formData.get("file") as File | null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(lineDate)) return fail("Falta la fecha del gasto.");
  if (lineDate > todayISO()) return fail("La fecha del gasto no puede ser futura.");
  if (!["UYU", "USD"].includes(currency)) return fail("Moneda inválida.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("El monto tiene que ser mayor a cero.");
  if (!subcategoryId) return fail("Elegí en qué se gastó (el rubro).");
  if (!description) return fail("Escribí un detalle corto: qué se compró y dónde.");

  let storage: { path: string; name: string; mime: string; size: number } | null = null;
  if (file && file.size > 0) {
    if (!isAcceptedAttachment(file.type)) return fail("El comprobante tiene que ser una foto o un PDF.");
    if (file.size > MAX_ATTACHMENT_BYTES) return fail("El comprobante pesa demasiado (máximo 10 MB).");
    const path = `${box.locality_id}/caja/${box.id}/${randomUUID()}.${extensionFor(file)}`;
    const { error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      console.error("[addCashLineAction] storage:", error);
      return fail("No se pudo guardar el comprobante. Probá de nuevo.");
    }
    storage = { path, name: file.name.slice(0, 120), mime: file.type, size: file.size };
  }

  const report = await openReportFor(supabase, box, session.user.id);
  if (!report) return fail("No se pudo abrir la rendición. Puede faltar la migración 074.");

  const { error } = await supabase.from("treasury_cash_lines").insert({
    report_id: report.id,
    locality_id: box.locality_id,
    line_date: lineDate,
    currency,
    amount: Math.round(amount * 100) / 100,
    subcategory_id: subcategoryId,
    description,
    storage_path: storage?.path ?? null,
    file_name: storage?.name ?? null,
    mime_type: storage?.mime ?? null,
    size_bytes: storage?.size ?? null,
    created_by: session.user.id,
  });
  if (error) {
    console.error("[addCashLineAction]", error);
    if (storage) await supabase.storage.from(RECEIPTS_BUCKET).remove([storage.path]);
    return fail(isCashSchemaMissing(error) ? "Falta la migración 074." : "No se pudo guardar el gasto.");
  }
  revalidatePath("/caja");
  return ok;
}

export async function removeCashLineAction(formData: FormData): Promise<Result> {
  const session = await requireBahai("/caja");
  const supabase = createSupabaseServer();
  const lineId = str(formData, "line_id");
  if (!lineId) return fail("Falta el gasto.");
  const { data } = await supabase
    .from("treasury_cash_lines")
    .select("id, storage_path, report_id")
    .eq("id", lineId)
    .maybeSingle();
  const line = data as { id: string; storage_path: string | null; report_id: string } | null;
  if (!line) return fail("El gasto ya no existe.");
  const report = await getCashReport(supabase, line.report_id);
  if (!report || !["borrador", "devuelta"].includes(report.status)) {
    return fail("Esta rendición ya fue enviada: no se puede tocar.");
  }
  const { error } = await supabase.from("treasury_cash_lines").delete().eq("id", lineId);
  if (error) return fail("No se pudo quitar el gasto.");
  if (line.storage_path) await supabase.storage.from(RECEIPTS_BUCKET).remove([line.storage_path]);
  void session;
  revalidatePath("/caja");
  return ok;
}

export async function submitCashReportAction(formData: FormData): Promise<Result> {
  const session = await requireBahai("/caja");
  const supabase = createSupabaseServer();
  const reportId = str(formData, "report_id");
  const report = reportId ? await getCashReport(supabase, reportId) : null;
  if (!report) return fail("La rendición no existe.");
  if (!["borrador", "devuelta"].includes(report.status)) return fail("Esta rendición ya fue enviada.");
  const box = await getCashBox(supabase, report.box_id);
  if (!box || box.holder_profile_id !== session.user.id) return fail("Esa caja no es tuya.");

  const lines = await getCashLines(supabase, [report.id]);
  if (lines.length === 0) return fail("Cargá al menos un gasto antes de rendir.");

  const countedUyuRaw = str(formData, "counted_uyu");
  const countedUsdRaw = str(formData, "counted_usd");
  const countedUyu = countedUyuRaw ? parseMoney(countedUyuRaw) : 0;
  const countedUsd = countedUsdRaw ? parseMoney(countedUsdRaw) : 0;
  if (!Number.isFinite(countedUyu) || countedUyu < 0) return fail("Los pesos contados no son un monto válido.");
  if (!Number.isFinite(countedUsd) || countedUsd < 0) return fail("Los dólares contados no son un monto válido.");

  const balance = await getCashBoxBalance(supabase, box.id);
  const expected = expectedCash(balance, lines);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("treasury_cash_reports")
    .update({
      status: "enviada",
      counted_uyu: Math.round(countedUyu * 100) / 100,
      counted_usd: Math.round(countedUsd * 100) / 100,
      expected_uyu: expected.find((e) => e.currency === "UYU")?.amount ?? 0,
      expected_usd: expected.find((e) => e.currency === "USD")?.amount ?? 0,
      note: str(formData, "note").slice(0, 1000) || null,
      submitted_at: now,
      submitted_by: session.user.id,
      updated_at: now,
    })
    .eq("id", report.id);
  if (error) {
    console.error("[submitCashReportAction]", error);
    return fail("No se pudo enviar la rendición.");
  }

  // Avisar a quien atiende la Tesorería de ESA comunidad (la de la caja).
  const treasurers = await getChatAdminIds(box.locality_id, session.user.id, "tesoreria");
  const totals = linesTotal(lines);
  const { data: acc } = await supabase.from("treasury_accounts").select("name").eq("id", box.account_id).maybeSingle();
  await sendPushToUsers(treasurers, {
    title: "Rendición de caja chica para revisar",
    body: `${(acc as { name: string } | null)?.name ?? "Caja chica"} · ${session.profile.full_name ?? "Responsable"} · ${lines.length} ${
      lines.length === 1 ? "gasto" : "gastos"
    } · ${totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ")}`,
    url: `/admin/tesoreria/cajas/${box.id}/rendicion/${report.id}`,
    tag: `rendicion-${report.id}`,
  });

  setFlashToast({ tone: "success", message: "Rendición enviada. Te avisamos cuando el tesorero la revise." });
  revalidatePath("/caja");
  revalidatePath("/admin/tesoreria/cajas", "layout");
  revalidatePath("/admin");
  return ok;
}
