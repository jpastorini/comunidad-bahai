"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { RECEIPTS_BUCKET } from "@/lib/treasury-attachments";
import { monthKeyOf, monthLabel } from "@/lib/treasury-cashbook";
import { formatReceiptDate, parseMoney } from "@/lib/treasury-format";
import { todayISO } from "@/lib/treasury-ledger";

type Result = { ok: boolean; error: string | null };

/** El alta devuelve además el id: los comprobantes se suben después de
 *  guardar, porque cuelgan del movimiento y antes no existe. */
type SaveResult = Result & { id: string | null };

const ok: Result = { ok: true, error: null };
const fail = (error: string): Result => ({ ok: false, error });
const failSave = (error: string): SaveResult => ({ ok: false, error, id: null });

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

type ServerClient = ReturnType<typeof createSupabaseServer>;

/**
 * Los errores del trigger `treasury_entries_guard` (migración 054)
 * empiezan con un código en mayúsculas seguido de dos puntos y la frase
 * ya escrita para la persona. Se devuelve la frase; cualquier otro error
 * de la base pasa tal cual.
 */
function friendlyDbError(message: string): string {
  const m = message.match(/^(MES_CERRADO|RECIBO_EMITIDO|ANULADO):\s*(.+)$/);
  return m ? m[2] : message;
}

/**
 * Resuelve el contribuyente del movimiento. Tres caminos, según lo que
 * eligió el tesorero en el buscador (ver ContributorPicker):
 *
 *  · `contributor_id`         — uno que ya está en el libro. Si además
 *                               vino `link_profile_id`, se lo vincula al
 *                               creyente (es como se van emparejando los
 *                               importados de la planilla).
 *  · `contributor_profile_id` — un creyente de la app. Se usa su
 *                               contribuyente vinculado; si no tiene, se
 *                               crea (o se vincula uno suelto que ya
 *                               exista con su mismo nombre).
 *  · `contributor_name`       — un nombre nuevo: alguien de otra
 *                               comunidad, una empresa, un grupo.
 *
 * Devuelve null cuando el movimiento no tiene contribuyente (un gasto).
 */
async function resolveContributor(
  supabase: ServerClient,
  formData: FormData
): Promise<string | null> {
  const id = str(formData, "contributor_id");
  if (id) {
    const linkProfileId = str(formData, "link_profile_id");
    if (linkProfileId) await linkContributor(supabase, id, linkProfileId);
    return id;
  }

  const profileId = str(formData, "contributor_profile_id");
  if (profileId) return resolveContributorForProfile(supabase, profileId);

  const name = str(formData, "contributor_name");
  if (!name) return null;
  return findOrCreateContributor(supabase, name, null);
}

async function linkContributor(
  supabase: ServerClient,
  contributorId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from("treasury_contributors")
    .update({ profile_id: profileId })
    .eq("id", contributorId);
  if (error) {
    throw new Error(`No se pudo vincular el contribuyente: ${error.message}`);
  }
}

/** El contribuyente "persona" de un creyente; se crea si no existe. */
async function resolveContributorForProfile(
  supabase: ServerClient,
  profileId: string
): Promise<string> {
  const { data: linked } = await supabase
    .from("treasury_contributors")
    .select("id, kind")
    .eq("profile_id", profileId)
    .order("created_at");
  const rows = (linked ?? []) as Array<{ id: string; kind: string }>;
  // Una persona puede tener varios contribuyentes vinculados (a título
  // personal, por su negocio); para un aporte propio manda el personal.
  const personal = rows.find((r) => r.kind === "persona") ?? rows[0];
  if (personal) return personal.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", profileId)
    .maybeSingle();
  const p = profile as { full_name: string | null; email: string | null } | null;
  const name = p?.full_name?.trim() || p?.email?.trim();
  if (!name) throw new Error("Ese creyente no tiene nombre cargado.");

  return findOrCreateContributor(supabase, name, profileId);
}

/**
 * Busca por nombre (el índice único es sobre lower(btrim(name)), así que
 * la comparación va sin distinguir mayúsculas) y si no está lo crea.
 * Si el nombre ya existe suelto y venimos con un perfil, se lo vincula:
 * es el caso de los importados de la planilla.
 */
async function findOrCreateContributor(
  supabase: ServerClient,
  name: string,
  profileId: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from("treasury_contributors")
    .select("id, profile_id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; profile_id: string | null };
    if (profileId && !row.profile_id) {
      await linkContributor(supabase, row.id, profileId);
    } else if (profileId && row.profile_id !== profileId) {
      throw new Error(
        `Ya hay un contribuyente "${name}" vinculado a otro creyente.`
      );
    }
    return row.id;
  }

  const { data: created, error } = await supabase
    .from("treasury_contributors")
    .insert({ name, kind: "persona", profile_id: profileId })
    .select("id")
    .single();
  if (error) {
    throw new Error(`No se pudo crear el contribuyente: ${error.message}`);
  }
  return (created as { id: string }).id;
}

/**
 * Saca del bucket los archivos de los comprobantes de esos movimientos.
 * No borra las filas: de eso se encarga el cascade de la FK.
 */
async function purgeAttachmentFiles(
  supabase: ServerClient,
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) return;
  const { data } = await supabase
    .from("treasury_attachments")
    .select("storage_path")
    .in("entry_id", entryIds);
  const paths = ((data ?? []) as Array<{ storage_path: string }>).map(
    (a) => a.storage_path
  );
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove(paths);
  if (error) {
    // Un archivo huérfano en el bucket es molesto, no grave: no vale
    // abortar el borrado del movimiento por eso.
    console.error("[purgeAttachmentFiles]", error);
  }
}

/** ¿Está cerrado el mes de esa fecha? Falso si la 054 no corrió. */
async function monthIsClosed(
  supabase: ServerClient,
  localityId: string,
  iso: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("treasury_month_is_closed", {
    loc: localityId,
    d: iso,
  });
  if (error) return false;
  return Boolean(data);
}

type GuardRow = {
  id: string;
  locality_id: string;
  entry_date: string;
  amount: number | string;
  receipt_number: number | null;
  receipt_issued: boolean;
  voided_at: string | null;
  transfer_group_id: string | null;
  is_opening_balance: boolean;
  account_id: string;
  subcategory_id: string;
  category_id: string;
  fund_id: string | null;
  currency: string;
  description: string | null;
};

const GUARD_FIELDS =
  "id, locality_id, entry_date, amount, receipt_number, receipt_issued, voided_at, transfer_group_id, is_opening_balance, account_id, subcategory_id, category_id, fund_id, currency, description";

async function loadGuardRow(
  supabase: ServerClient,
  id: string
): Promise<GuardRow | null> {
  const { data } = await supabase
    .from("treasury_entries")
    .select(GUARD_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return (data as GuardRow | null) ?? null;
}

/**
 * El próximo número de recibo, con reintento: si dos tesoreros cargan a
 * la vez, el segundo insert choca con el índice único y se pide otro.
 */
async function nextReceiptNumber(
  supabase: ServerClient,
  localityId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("next_receipt_number", { loc: localityId });
  if (error) throw new Error(`No se pudo obtener el próximo recibo: ${error.message}`);
  return Number(data) || 1;
}

/**
 * Alta o edición de un movimiento.
 *
 * Desde la 054, todo aporte lleva número de recibo: si el campo queda
 * vacío se asigna el siguiente de la serie. El formulario no cambia; el
 * tesorero carga igual que siempre y el número aparece solo.
 */
export async function saveEntryAction(formData: FormData): Promise<SaveResult> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  const entryDate = str(formData, "entry_date");
  const accountId = str(formData, "account_id");
  const subcategoryId = str(formData, "subcategory_id");
  const currency = str(formData, "currency");
  const direction = str(formData, "direction"); // 'ingreso' | 'gasto'
  const amountRaw = parseMoney(str(formData, "amount"));

  if (!entryDate) return failSave("Falta la fecha.");
  if (!accountId) return failSave("Elegí la cuenta.");
  if (!subcategoryId) return failSave("Elegí la subcategoría.");
  if (!["UYU", "USD"].includes(currency)) return failSave("Moneda inválida.");
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return failSave("El monto tiene que ser mayor a cero.");
  }

  // Antes de tocar nada: un mes cerrado no admite el movimiento, y un
  // anulado o un recibo emitido no se editan (se anulan). El trigger lo
  // garantiza igual; acá es para que el aviso llegue antes y en palabras.
  if (await monthIsClosed(supabase, session.locality.id, entryDate)) {
    return failSave(
      `${monthLabel(monthKeyOf(entryDate))} está cerrado. Cargá el movimiento con fecha del mes abierto o revertí el original con un contra-asiento.`
    );
  }
  if (id) {
    const current = await loadGuardRow(supabase, id);
    if (!current) return failSave("El movimiento ya no existe.");
    if (current.voided_at) return failSave("El movimiento está anulado y no se puede modificar.");
    if (current.receipt_issued) {
      return failSave(
        `El recibo N.º ${current.receipt_number ?? "—"} ya fue emitido. Si está mal, anulalo y cargá uno nuevo.`
      );
    }
    if (await monthIsClosed(supabase, session.locality.id, current.entry_date)) {
      return failSave(
        `El movimiento está en ${monthLabel(monthKeyOf(current.entry_date))}, que ya se cerró. Revertilo con un contra-asiento.`
      );
    }
  }

  // La categoría no se elige: la manda la subcategoría, como en la
  // planilla. Así no queda un rubro con la categoría cambiada a mano.
  const { data: sub } = await supabase
    .from("treasury_subcategories")
    .select("category_id, default_fund_id")
    .eq("id", subcategoryId)
    .maybeSingle();
  if (!sub) return failSave("La subcategoría no existe.");
  const subcategory = sub as {
    category_id: string;
    default_fund_id: string | null;
  };

  const fundId = str(formData, "fund_id") || subcategory.default_fund_id || null;
  const amount = direction === "gasto" ? -amountRaw : amountRaw;

  const receiptRaw = str(formData, "receipt_number");
  let receiptNumber: number | null = receiptRaw ? parseInt(receiptRaw, 10) : null;
  if (receiptRaw && Number.isNaN(receiptNumber)) {
    return failSave("El número de recibo tiene que ser un número.");
  }
  // Todo aporte lleva recibo (DGI: numeración correlativa). Un gasto no.
  const isContribution = amount > 0;
  let autoNumbered = false;
  if (isContribution && receiptNumber === null) {
    try {
      receiptNumber = await nextReceiptNumber(supabase, session.locality.id);
      autoNumbered = true;
    } catch (err) {
      return failSave(err instanceof Error ? err.message : "Error con el número de recibo.");
    }
  }
  if (!isContribution) receiptNumber = null;

  let contributorId: string | null;
  try {
    contributorId = await resolveContributor(supabase, formData);
  } catch (err) {
    return failSave(
      err instanceof Error ? err.message : "Error con el contribuyente."
    );
  }

  const buildPayload = (receipt: number | null) => ({
    entry_date: entryDate,
    bahai_year: parseInt(str(formData, "bahai_year"), 10) || null,
    account_id: accountId,
    subcategory_id: subcategoryId,
    category_id: subcategory.category_id,
    fund_id: fundId,
    currency,
    amount,
    description: str(formData, "description") || null,
    receipt_number: receipt,
    contributions_count: parseInt(str(formData, "contributions_count"), 10) || 0,
    contributor_id: contributorId,
    // El seudónimo es del aporte, no del contribuyente: "Familia Pérez"
    // en el recibo, Juan Pérez en el libro. Sin contribuyente no tiene
    // sentido y se descarta.
    receipt_name: contributorId ? str(formData, "receipt_name") || null : null,
    receipt_issued: str(formData, "receipt_issued") === "on",
  });

  const write = async (receipt: number | null) =>
    id
      ? supabase
          .from("treasury_entries")
          .update({ ...buildPayload(receipt), updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : supabase
          .from("treasury_entries")
          .insert({ ...buildPayload(receipt), created_by: session.user.id })
          .select("id")
          .maybeSingle();

  let { data: saved, error } = await write(receiptNumber);

  // Choque de números: si el número lo puso el sistema, se pide el
  // siguiente y se reintenta una vez; si lo tipeó el tesorero, se avisa.
  if (error && error.code === "23505" && error.message.includes("receipt")) {
    if (autoNumbered) {
      try {
        receiptNumber = await nextReceiptNumber(supabase, session.locality.id);
      } catch (err) {
        return failSave(err instanceof Error ? err.message : "Error con el número de recibo.");
      }
      ({ data: saved, error } = await write(receiptNumber));
    }
    if (error && error.code === "23505") {
      return failSave(
        `El recibo N° ${receiptNumber} ya está usado en otro movimiento.`
      );
    }
  }

  if (error) return failSave(friendlyDbError(error.message));

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return { ok: true, error: null, id: (saved as { id: string } | null)?.id ?? id ?? null };
}

/**
 * Borrar un movimiento. Solo en un mes abierto y solo si su recibo no fue
 * emitido: si no, la salida es anular (voidEntryAction) o revertir
 * (revertEntryAction). Las dos reglas viven en el trigger; acá se
 * chequean ANTES para no purgar los comprobantes del bucket de un
 * movimiento que después la base se niega a borrar.
 */
export async function deleteEntryAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  if (!id) return fail("Falta el movimiento.");

  const entry = await loadGuardRow(supabase, id);
  if (!entry) return fail("El movimiento ya no existe.");

  if (await monthIsClosed(supabase, session.locality.id, entry.entry_date)) {
    return fail(
      `${monthLabel(monthKeyOf(entry.entry_date))} está cerrado. Revertí el movimiento con un contra-asiento.`
    );
  }

  const group = entry.transfer_group_id;

  // Qué asientos se van: el solo, o los dos de la transferencia.
  const { data: doomed } = group
    ? await supabase
        .from("treasury_entries")
        .select("id, receipt_issued, receipt_number")
        .eq("transfer_group_id", group)
    : { data: [entry] };
  const rows = (doomed ?? []) as Array<{
    id: string;
    receipt_issued: boolean;
    receipt_number: number | null;
  }>;
  const issued = rows.find((r) => r.receipt_issued);
  if (issued) {
    return fail(
      `El recibo N.º ${issued.receipt_number ?? "—"} ya fue emitido: anulalo en vez de borrarlo.`
    );
  }
  const entryIds = rows.map((e) => e.id);

  // Los comprobantes: la fila se la lleva el cascade, el archivo no.
  // Se borran ANTES del asiento, porque después la RLS ya no deja
  // encontrarlos y quedarían ocupando el bucket para siempre.
  await purgeAttachmentFiles(supabase, entryIds);

  const { error } = group
    ? await supabase
        .from("treasury_entries")
        .delete()
        .eq("transfer_group_id", group)
    : await supabase.from("treasury_entries").delete().eq("id", id);

  if (error) return fail(friendlyDbError(error.message));

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return ok;
}

/**
 * Anular un movimiento con recibo (migración 054).
 *
 * El recibo puede estar en manos del contribuyente, así que el
 * movimiento no se borra ni se edita: queda marcado como anulado, con
 * motivo y quién lo anuló, deja de sumar en todos los saldos y su número
 * sigue ocupando el lugar en la serie. La hoja del recibo imprime
 * "ANULADO" cruzado. Si el aporte fue real y solo estaba mal cargado, el
 * tesorero carga uno nuevo, que toma el número siguiente.
 *
 * Solo en un mes abierto: anular cambia el saldo del mes, y un mes cerrado
 * se corrige con un contra-asiento.
 */
export async function voidEntryAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  const reason = str(formData, "reason");
  if (!id) return fail("Falta el movimiento.");
  if (reason.length < 3) return fail("Escribí el motivo de la anulación.");

  const entry = await loadGuardRow(supabase, id);
  if (!entry) return fail("El movimiento ya no existe.");
  if (entry.voided_at) return fail("Ese movimiento ya está anulado.");
  if (entry.transfer_group_id || entry.is_opening_balance) {
    return fail("Las transferencias y los saldos iniciales no se anulan: se borran o se revierten.");
  }
  if (await monthIsClosed(supabase, session.locality.id, entry.entry_date)) {
    return fail(
      `${monthLabel(monthKeyOf(entry.entry_date))} está cerrado. Revertí el movimiento con un contra-asiento.`
    );
  }

  const { error } = await supabase
    .from("treasury_entries")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: session.user.id,
      void_reason: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return fail(friendlyDbError(error.message));

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  revalidatePath(`/admin/tesoreria/recibo/${id}`);
  return ok;
}

/**
 * Contra-asiento (migración 054): la forma de corregir un movimiento de
 * un mes cerrado sin tocar el mes cerrado.
 *
 * Crea un movimiento con fecha de hoy, en la misma cuenta, moneda, rubro
 * y fondo, con el monto invertido, que apunta al original y explica por
 * qué. Los dos quedan a la vista en el libro: el original tal cual se
 * cerró y la corrección en el mes abierto, que es exactamente lo que el
 * MEC quiere ver en vez de una tachadura. Si el original era una
 * transferencia se revierten las dos patas, atadas por un grupo nuevo.
 *
 * Después, si hacía falta el movimiento bien cargado, el tesorero lo
 * carga como siempre.
 */
export async function revertEntryAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  const reason = str(formData, "reason");
  if (!id) return fail("Falta el movimiento.");
  if (reason.length < 3) return fail("Escribí el motivo de la corrección.");

  const original = await loadGuardRow(supabase, id);
  if (!original) return fail("El movimiento ya no existe.");
  if (original.voided_at) return fail("El movimiento está anulado: ya no suma nada.");

  const today = todayISO();
  if (await monthIsClosed(supabase, session.locality.id, today)) {
    return fail(
      `${monthLabel(monthKeyOf(today))} está cerrado: reabrilo o esperá al mes siguiente.`
    );
  }

  // ¿Ya fue revertido? Un segundo contra-asiento duplicaría la corrección.
  const { data: prior } = await supabase
    .from("treasury_entries")
    .select("id")
    .eq("adjusts_entry_id", id)
    .is("voided_at", null)
    .limit(1);
  if ((prior ?? []).length > 0) {
    return fail("Ese movimiento ya tiene un contra-asiento.");
  }

  let legs: GuardRow[] = [original];
  if (original.transfer_group_id) {
    const { data } = await supabase
      .from("treasury_entries")
      .select(GUARD_FIELDS)
      .eq("transfer_group_id", original.transfer_group_id);
    legs = ((data ?? []) as GuardRow[]).length > 0 ? ((data ?? []) as GuardRow[]) : [original];
  }

  const group = original.transfer_group_id ? randomUUID() : null;
  const bahaiYear = parseInt(str(formData, "bahai_year"), 10) || null;

  const rows = legs.map((leg) => ({
    entry_date: today,
    bahai_year: bahaiYear,
    account_id: leg.account_id,
    subcategory_id: leg.subcategory_id,
    category_id: leg.category_id,
    fund_id: leg.fund_id,
    currency: leg.currency,
    amount: -Number(leg.amount),
    description: `Contra-asiento del movimiento del ${formatReceiptDate(leg.entry_date)}${
      leg.receipt_number ? ` (recibo N.º ${leg.receipt_number})` : ""
    }${leg.description ? `: ${leg.description}` : ""}`.slice(0, 500),
    receipt_number: null,
    contributions_count: 0,
    contributor_id: null,
    receipt_name: null,
    receipt_issued: false,
    transfer_group_id: group,
    adjusts_entry_id: leg.id,
    adjustment_reason: reason.slice(0, 500),
    created_by: session.user.id,
  }));

  const { error } = await supabase.from("treasury_entries").insert(rows);
  if (error) return fail(friendlyDbError(error.message));

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return ok;
}

/**
 * Cambio de caja o compra de divisas: una salida y una entrada atadas.
 * Se cargan juntas para que no pueda quedar media operación, y admiten
 * monedas distintas (la compra de divisas sale en pesos y entra en
 * dólares, y el tipo de cambio queda implícito en los dos montos).
 */
export async function saveTransferAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const entryDate = str(formData, "entry_date");
  const fromAccount = str(formData, "from_account_id");
  const toAccount = str(formData, "to_account_id");
  const subcategoryId = str(formData, "subcategory_id");
  const fromCurrency = str(formData, "from_currency");
  const toCurrency = str(formData, "to_currency");
  const fromAmount = parseMoney(str(formData, "from_amount"));
  const toAmount = parseMoney(str(formData, "to_amount"));

  if (!entryDate) return fail("Falta la fecha.");
  if (!fromAccount || !toAccount) return fail("Elegí las dos cuentas.");
  if (fromAccount === toAccount && fromCurrency === toCurrency) {
    return fail("El origen y el destino son la misma cuenta y la misma moneda.");
  }
  if (!subcategoryId) return fail("Elegí la subcategoría.");
  if (!["UYU", "USD"].includes(fromCurrency)) return fail("Moneda de salida inválida.");
  if (!["UYU", "USD"].includes(toCurrency)) return fail("Moneda de entrada inválida.");
  if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
    return fail("El monto que sale tiene que ser mayor a cero.");
  }
  if (!Number.isFinite(toAmount) || toAmount <= 0) {
    return fail("El monto que entra tiene que ser mayor a cero.");
  }
  if (await monthIsClosed(supabase, session.locality.id, entryDate)) {
    return fail(`${monthLabel(monthKeyOf(entryDate))} está cerrado. Usá una fecha del mes abierto.`);
  }

  const { data: sub } = await supabase
    .from("treasury_subcategories")
    .select("category_id, default_fund_id")
    .eq("id", subcategoryId)
    .maybeSingle();
  if (!sub) return fail("La subcategoría no existe.");
  const subcategory = sub as {
    category_id: string;
    default_fund_id: string | null;
  };

  const fundId = str(formData, "fund_id") || subcategory.default_fund_id || null;
  const group = randomUUID();

  const common = {
    entry_date: entryDate,
    bahai_year: parseInt(str(formData, "bahai_year"), 10) || null,
    subcategory_id: subcategoryId,
    category_id: subcategory.category_id,
    fund_id: fundId,
    description: str(formData, "description") || null,
    transfer_group_id: group,
    created_by: session.user.id,
  };

  const { error } = await supabase.from("treasury_entries").insert([
    {
      ...common,
      account_id: fromAccount,
      currency: fromCurrency,
      amount: -fromAmount,
    },
    {
      ...common,
      account_id: toAccount,
      currency: toCurrency,
      amount: toAmount,
    },
  ]);

  if (error) return fail(friendlyDbError(error.message));

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return ok;
}

/**
 * Marca el recibo como emitido. Es la columna que en la planilla era un
 * TRUE/FALSE al lado del contribuyente y alimentaba el script de Apps
 * Script; acá se prende sola al imprimir o compartir.
 *
 * Registra también QUIÉN lo emitió: ese nombre va en la firma de la
 * copia que el creyente baja desde "Mis aportes" (my_receipt, 046).
 *
 * Es la única escritura que el trigger admite sobre un mes cerrado:
 * imprimir un recibo después no cambia el libro.
 */
export async function markReceiptIssuedAction(
  formData: FormData
): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  if (!id) return fail("Falta el movimiento.");

  const { error } = await supabase
    .from("treasury_entries")
    .update({
      receipt_issued: true,
      receipt_issued_at: new Date().toISOString(),
      receipt_issued_by: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return fail(friendlyDbError(error.message));

  revalidatePath("/admin/tesoreria/libro");
  return ok;
}
