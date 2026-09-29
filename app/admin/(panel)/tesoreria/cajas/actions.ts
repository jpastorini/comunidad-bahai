"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import {
  cashDifferences,
  expectedCash,
  getCashBox,
  getCashBoxBalance,
  getCashLines,
  getCashReport,
  isCashSchemaMissing,
  linesTotal,
  type Money,
} from "@/lib/treasury-cash";
import { formatMoney, parseMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";
import { treasuryYearForDate } from "@/lib/treasury-year";
import { monthKeyOf, monthLabel } from "@/lib/treasury-cashbook";

/**
 * Cajas chicas (074), lado del tesorero: crear y ajustar cajas, hacer el
 * arqueo, y aprobar o devolver una rendición.
 *
 * Aprobar es lo delicado: convierte las líneas del responsable en
 * asientos del libro (uno por gasto, con su comprobante) y genera la
 * reposición desde la cuenta de origen. No hay transacción entre
 * PostgREST y Storage, así que el orden está pensado para que un fallo a
 * mitad de camino deje algo REINTENTABLE, no algo roto: cada línea que
 * ya tiene `entry_id` se saltea en el reintento, la rendición sigue
 * "enviada" hasta el último paso, y el toast dice qué faltó.
 */

const LIST = "/admin/tesoreria/cajas";

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function fail(message: string, to: string = LIST): never {
  setFlashToast({ tone: "error", message });
  redirect(to);
}

function done(message: string, to: string): never {
  setFlashToast({ tone: "success", message });
  revalidatePath(LIST, "layout");
  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin");
  revalidatePath("/caja");
  redirect(to);
}

function amountOrZero(raw: string, what: string, to: string): number {
  if (!raw) return 0;
  const n = parseMoney(raw);
  if (!Number.isFinite(n) || n < 0) fail(`${what} no es un monto válido.`, to);
  return Math.round(n * 100) / 100;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function monthIsClosed(
  supabase: ReturnType<typeof createSupabaseServer>,
  localityId: string,
  iso: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("treasury_month_is_closed", { loc: localityId, d: iso });
  return !error && Boolean(data);
}

async function holderName(
  supabase: ReturnType<typeof createSupabaseServer>,
  id: string | null
): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return (data as { full_name: string | null } | null)?.full_name ?? null;
}

// ─── La caja ─────────────────────────────────────────────────────

export async function saveCashBoxAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const id = str(formData, "id");
  const back = id ? `${LIST}/${id}` : LIST;
  let accountId = str(formData, "account_id");
  const newAccountName = str(formData, "new_account_name").slice(0, 80);

  // La cuenta: una existente del catálogo o una nueva con nombre.
  if (!accountId) {
    if (!newAccountName) fail("Elegí la cuenta de la caja o escribí el nombre de una nueva.", back);
    const { data: last } = await supabase
      .from("treasury_accounts")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;
    const { data: created, error } = await supabase
      .from("treasury_accounts")
      .insert({ name: newAccountName, sort_order: sortOrder, is_active: true })
      .select("id")
      .single();
    if (error || !created) fail(`No se pudo crear la cuenta: ${error?.message ?? ""}`, back);
    accountId = (created as { id: string }).id;
  } else {
    const { data: acc } = await supabase
      .from("treasury_accounts")
      .select("id")
      .eq("id", accountId)
      .maybeSingle();
    if (!acc) fail("La cuenta elegida no existe en esta comunidad.", back);
  }

  const holderId = str(formData, "holder_profile_id") || null;
  const sourceId = str(formData, "source_account_id") || null;
  if (sourceId && sourceId === accountId) fail("La cuenta de origen no puede ser la misma caja.", back);
  const fundId = str(formData, "default_fund_id") || null;

  const payload = {
    locality_id: localityId,
    account_id: accountId,
    holder_profile_id: holderId,
    source_account_id: sourceId,
    default_fund_id: fundId,
    fixed_uyu: amountOrZero(str(formData, "fixed_uyu"), "El fondo fijo en pesos", back),
    fixed_usd: amountOrZero(str(formData, "fixed_usd"), "El fondo fijo en dólares", back),
    notes: str(formData, "notes").slice(0, 1000) || null,
    updated_at: new Date().toISOString(),
  };

  let previousHolder: string | null = null;
  let boxId = id;
  if (id) {
    const current = await getCashBox(supabase, id);
    if (!current) fail("La caja no existe.");
    previousHolder = current.holder_profile_id;
    const { error } = await supabase.from("treasury_cash_boxes").update(payload).eq("id", id);
    if (error) fail(isCashSchemaMissing(error) ? "Falta aplicar la migración 074." : error.message, back);
  } else {
    const { data, error } = await supabase
      .from("treasury_cash_boxes")
      .insert({ ...payload, created_by: session.user.id })
      .select("id")
      .single();
    if (error || !data) {
      fail(
        isCashSchemaMissing(error)
          ? "Falta aplicar la migración 074."
          : error?.code === "23505"
            ? "Esa cuenta ya es una caja chica."
            : error?.message ?? "No se pudo crear la caja.",
        back
      );
    }
    boxId = (data as { id: string }).id;
  }

  // Avisar al responsable nuevo: es su puerta de entrada a "Mi caja chica".
  if (holderId && holderId !== previousHolder && holderId !== session.user.id) {
    const { data: acc } = await supabase
      .from("treasury_accounts")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();
    await sendPushToUsers([holderId], {
      title: "Te asignaron una caja chica",
      body: `${(acc as { name: string } | null)?.name ?? "Caja chica"} · ${session.locality.name}. Desde la app cargás los gastos con su comprobante y rendís cuando corresponda.`,
      url: "/caja",
      tag: `caja-${boxId}`,
    });
  }

  done(id ? "Caja actualizada." : "Caja chica creada.", `${LIST}/${boxId}`);
}

export async function setCashBoxActiveAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const id = str(formData, "id");
  const active = str(formData, "active") === "1";
  if (!id) fail("Falta la caja.");
  const { error } = await supabase
    .from("treasury_cash_boxes")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(error.message, `${LIST}/${id}`);
  done(active ? "Caja reactivada." : "Caja desactivada. La cuenta y su historial siguen en el libro.", `${LIST}/${id}`);
}

// ─── El arqueo ───────────────────────────────────────────────────

export async function saveCashCountAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const boxId = str(formData, "box_id");
  const back = `${LIST}/${boxId}`;
  if (!boxId) fail("Falta la caja.");
  const countedOn = str(formData, "counted_on") || todayISO();
  if (!DATE_RE.test(countedOn)) fail("La fecha del arqueo no es válida.", back);

  const [balance, openReports] = await Promise.all([
    getCashBoxBalance(supabase, boxId),
    supabase
      .from("treasury_cash_reports")
      .select("id")
      .eq("box_id", boxId)
      .in("status", ["borrador", "devuelta", "enviada"]),
  ]);
  // Lo que el responsable ya gastó y todavía no entró al libro también
  // falta del efectivo: se descuenta para no gritar un faltante que no es.
  const openIds = ((openReports.data ?? []) as { id: string }[]).map((r) => r.id);
  const pendingLines = await getCashLines(supabase, openIds);
  const expected = expectedCash(balance, pendingLines);

  const counted: Money[] = [
    { currency: "UYU", amount: amountOrZero(str(formData, "counted_uyu"), "Lo contado en pesos", back) },
    { currency: "USD", amount: amountOrZero(str(formData, "counted_usd"), "Lo contado en dólares", back) },
  ];
  const { error } = await supabase.from("treasury_cash_counts").insert({
    box_id: boxId,
    counted_on: countedOn,
    counted_uyu: counted[0].amount,
    counted_usd: counted[1].amount,
    expected_uyu: expected.find((e) => e.currency === "UYU")?.amount ?? 0,
    expected_usd: expected.find((e) => e.currency === "USD")?.amount ?? 0,
    note: str(formData, "note").slice(0, 1000) || null,
    counted_by: session.user.id,
  });
  if (error) fail(isCashSchemaMissing(error) ? "Falta aplicar la migración 074." : error.message, back);

  const diffs = cashDifferences(counted, expected);
  done(
    diffs.length === 0
      ? "Arqueo registrado: la caja cuadra con el libro."
      : `Arqueo registrado con diferencia: ${diffs
          .map((d) => `${d.amount > 0 ? "sobran" : "faltan"} ${formatMoney(Math.abs(d.amount), d.currency)}`)
          .join(", ")}. Registrá el ajuste en el libro con su motivo.`,
    back
  );
}

// ─── Revisar una rendición ───────────────────────────────────────

export async function reviewCashReportAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const reportId = str(formData, "report_id");
  const decision = str(formData, "decision");
  const report = reportId ? await getCashReport(supabase, reportId) : null;
  if (!report) fail("La rendición no existe.");
  const back = `${LIST}/${report.box_id}/rendicion/${report.id}`;
  if (report.status !== "enviada") fail("Esta rendición ya no está esperando revisión.", back);
  const box = await getCashBox(supabase, report.box_id);
  if (!box) fail("La caja no existe.");
  const reviewNote = str(formData, "review_note").slice(0, 1000) || null;
  const now = new Date().toISOString();

  if (decision === "devolver") {
    if (!reviewNote) fail("Para devolverla, decile al responsable qué corregir.", back);
    const { error } = await supabase
      .from("treasury_cash_reports")
      .update({ status: "devuelta", reviewed_at: now, reviewed_by: session.user.id, review_note: reviewNote, updated_at: now })
      .eq("id", report.id);
    if (error) fail(error.message, back);
    if (box.holder_profile_id) {
      await sendPushToUsers([box.holder_profile_id], {
        title: "Rendición devuelta para corregir",
        body: reviewNote.slice(0, 140),
        url: "/caja",
        tag: `rendicion-${report.id}`,
      });
    }
    done("Rendición devuelta al responsable.", `${LIST}/${box.id}`);
  }
  if (decision !== "aprobar") fail("Decisión inválida.", back);

  const today = todayISO();
  const lines = await getCashLines(supabase, [report.id]);
  if (lines.length === 0) fail("La rendición no tiene gastos: devolvela o pedí que la cierre sin gastos.", back);
  if (lines.some((l) => !l.subcategory_id)) {
    fail("Hay gastos sin rubro. Devolvé la rendición para que el responsable lo complete.", back);
  }

  // Rubros → categoría y fondo, de una vez.
  const subIds = [...new Set(lines.map((l) => l.subcategory_id!))];
  const { data: subsRaw } = await supabase
    .from("treasury_subcategories")
    .select("id, category_id, default_fund_id")
    .in("id", subIds);
  const subs = new Map(
    ((subsRaw ?? []) as { id: string; category_id: string; default_fund_id: string | null }[]).map((s) => [s.id, s])
  );

  // 1) Un asiento por gasto, salteando los que ya entraron (reintento).
  let created = 0;
  for (const line of lines) {
    if (line.entry_id) continue;
    const sub = subs.get(line.subcategory_id!);
    if (!sub) fail("Un rubro de la rendición ya no existe en el catálogo.", back);
    // Un gasto fechado en un mes cerrado entra con la fecha de hoy y la
    // fecha original en la descripción: el mes cerrado no se toca (054).
    const closed = await monthIsClosed(supabase, localityId, line.line_date);
    const entryDate = closed ? today : line.line_date;
    const description = [
      "Caja chica",
      line.description,
      closed ? `(gasto del ${line.line_date.split("-").reverse().join("/")}, mes cerrado)` : null,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500);
    const { data: entry, error } = await supabase
      .from("treasury_entries")
      .insert({
        entry_date: entryDate,
        bahai_year: treasuryYearForDate(entryDate),
        account_id: box.account_id,
        subcategory_id: line.subcategory_id,
        category_id: sub.category_id,
        fund_id: sub.default_fund_id ?? box.default_fund_id,
        currency: line.currency,
        amount: -line.amount,
        description,
        receipt_number: null,
        contributions_count: 0,
        contributor_id: null,
        receipt_name: null,
        receipt_issued: false,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error || !entry) {
      fail(
        `Se cargaron ${created} de ${lines.length} gastos y falló el siguiente: ${error?.message ?? "error"}. Volvé a aprobar para continuar; lo ya cargado no se repite.`,
        back
      );
    }
    const entryId = (entry as { id: string }).id;
    if (line.storage_path) {
      const { error: attError } = await supabase.from("treasury_attachments").insert({
        entry_id: entryId,
        storage_path: line.storage_path,
        file_name: line.file_name ?? "comprobante",
        mime_type: line.mime_type ?? "application/octet-stream",
        size_bytes: line.size_bytes ?? 0,
        amount: null,
        label: null,
        sort_order: 0,
        uploaded_by: session.user.id,
      });
      if (attError) console.error("[reviewCashReportAction] attachment:", attError);
    }
    await supabase.from("treasury_cash_lines").update({ entry_id: entryId }).eq("id", line.id);
    created++;
  }

  // 2) La reposición: dos asientos atados por moneda, del origen a la caja.
  let transferGroup: string | null = report.transfer_group_id;
  const replenish = str(formData, "replenish") === "on";
  if (replenish && !transferGroup) {
    const subcategoryId = str(formData, "replenish_subcategory_id");
    const entryDate = str(formData, "replenish_date") || today;
    if (!box.source_account_id) fail("La caja no tiene cuenta de origen: cargá la reposición a mano en el Libro.", back);
    if (!subcategoryId) fail("Elegí el rubro de la reposición (el de las transferencias entre cuentas).", back);
    if (!DATE_RE.test(entryDate)) fail("La fecha de la reposición no es válida.", back);
    if (await monthIsClosed(supabase, localityId, entryDate)) {
      fail(`${monthLabel(monthKeyOf(entryDate))} está cerrado: usá una fecha del mes abierto para la reposición.`, back);
    }
    const { data: sub } = await supabase
      .from("treasury_subcategories")
      .select("category_id, default_fund_id")
      .eq("id", subcategoryId)
      .maybeSingle();
    if (!sub) fail("El rubro de la reposición no existe.", back);
    const s = sub as { category_id: string; default_fund_id: string | null };
    const totals = linesTotal(lines);
    const group = randomUUID();
    for (const t of totals) {
      if (t.amount <= 0) continue;
      const common = {
        entry_date: entryDate,
        bahai_year: treasuryYearForDate(entryDate),
        subcategory_id: subcategoryId,
        category_id: s.category_id,
        fund_id: s.default_fund_id ?? box.default_fund_id,
        currency: t.currency,
        description: `Reposición de caja chica (rendición del ${report.submitted_at ? report.submitted_at.slice(0, 10).split("-").reverse().join("/") : today})`,
        transfer_group_id: group,
        created_by: session.user.id,
      };
      const { error } = await supabase.from("treasury_entries").insert([
        { ...common, account_id: box.source_account_id, amount: -t.amount },
        { ...common, account_id: box.account_id, amount: t.amount },
      ]);
      if (error) {
        fail(`Los gastos entraron pero la reposición falló: ${error.message}. Cargala a mano en el Libro como transferencia.`, back);
      }
    }
    transferGroup = group;
  }

  // 3) Cerrar la rendición.
  const { error: closeError } = await supabase
    .from("treasury_cash_reports")
    .update({
      status: "aprobada",
      reviewed_at: now,
      reviewed_by: session.user.id,
      review_note: reviewNote,
      transfer_group_id: transferGroup,
      updated_at: now,
    })
    .eq("id", report.id);
  if (closeError) fail(`Los asientos entraron pero la rendición quedó sin cerrar: ${closeError.message}. Volvé a aprobar.`, back);

  if (box.holder_profile_id) {
    const totals = linesTotal(lines);
    await sendPushToUsers([box.holder_profile_id], {
      title: "Rendición aprobada",
      body: `${totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ")} en ${lines.length} ${
        lines.length === 1 ? "gasto" : "gastos"
      }${replenish ? ", con la reposición en camino" : ""}.${reviewNote ? ` ${reviewNote}` : ""}`.slice(0, 180),
      url: "/caja",
      tag: `rendicion-${report.id}`,
    });
  }

  done(
    `Rendición aprobada: ${created} ${created === 1 ? "gasto entró" : "gastos entraron"} al libro${
      replenish ? " y la reposición quedó cargada" : ""
    }.`,
    `${LIST}/${box.id}`
  );
}
