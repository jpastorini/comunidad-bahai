"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { RECEIPTS_BUCKET } from "@/lib/treasury-attachments";
import { parseMoney } from "@/lib/treasury-format";

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
 * Resuelve el contribuyente: si vino un id lo usa; si vino un nombre
 * nuevo lo da de alta. Devuelve null cuando el movimiento no tiene
 * contribuyente (un gasto, por ejemplo).
 */
async function resolveContributor(
  supabase: ServerClient,
  formData: FormData
): Promise<string | null> {
  const id = str(formData, "contributor_id");
  if (id) return id;

  const name = str(formData, "contributor_name");
  if (!name) return null;

  // Puede existir con otra capitalización o con espacios de más: el
  // índice único es sobre lower(btrim(name)).
  const { data: existing } = await supabase
    .from("treasury_contributors")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const kind = str(formData, "contributor_kind") || "persona";
  const { data: created, error } = await supabase
    .from("treasury_contributors")
    .insert({ name, kind })
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

/** Alta o edición de un movimiento. */
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
  const receiptNumber = receiptRaw ? parseInt(receiptRaw, 10) : null;
  if (receiptRaw && Number.isNaN(receiptNumber)) {
    return failSave("El número de recibo tiene que ser un número.");
  }

  let contributorId: string | null;
  try {
    contributorId = await resolveContributor(supabase, formData);
  } catch (err) {
    return failSave(
      err instanceof Error ? err.message : "Error con el contribuyente."
    );
  }

  const payload = {
    entry_date: entryDate,
    bahai_year: parseInt(str(formData, "bahai_year"), 10) || null,
    account_id: accountId,
    subcategory_id: subcategoryId,
    category_id: subcategory.category_id,
    fund_id: fundId,
    currency,
    amount,
    description: str(formData, "description") || null,
    receipt_number: receiptNumber,
    contributions_count: parseInt(str(formData, "contributions_count"), 10) || 0,
    contributor_id: contributorId,
    receipt_issued: str(formData, "receipt_issued") === "on",
  };

  const { data: saved, error } = id
    ? await supabase
        .from("treasury_entries")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("treasury_entries")
        .insert({ ...payload, created_by: session.user.id })
        .select("id")
        .maybeSingle();

  if (error) {
    // El caso frecuente: repetir un número de recibo ya usado.
    if (error.code === "23505" && error.message.includes("receipt")) {
      return failSave(
        `El recibo N° ${receiptNumber} ya está usado en otro movimiento.`
      );
    }
    return failSave(error.message);
  }

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return { ok: true, error: null, id: (saved as { id: string } | null)?.id ?? id ?? null };
}

export async function deleteEntryAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  if (!id) return fail("Falta el movimiento.");

  // Si es una pata de una transferencia se borran las dos: media
  // transferencia deja el libro descuadrado.
  const { data: entry } = await supabase
    .from("treasury_entries")
    .select("transfer_group_id")
    .eq("id", id)
    .maybeSingle();

  const group = (entry as { transfer_group_id: string | null } | null)
    ?.transfer_group_id;

  // Qué asientos se van: el solo, o los dos de la transferencia.
  const { data: doomed } = group
    ? await supabase
        .from("treasury_entries")
        .select("id")
        .eq("transfer_group_id", group)
    : { data: [{ id }] };
  const entryIds = ((doomed ?? []) as Array<{ id: string }>).map((e) => e.id);

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

  if (error) return fail(error.message);

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

  if (error) return fail(error.message);

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return ok;
}

/**
 * Marca el recibo como emitido. Es la columna que en la planilla era un
 * TRUE/FALSE al lado del contribuyente y alimentaba el script de Apps
 * Script; acá se prende sola al imprimir o compartir.
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return fail(error.message);

  revalidatePath("/admin/tesoreria/libro");
  return ok;
}
