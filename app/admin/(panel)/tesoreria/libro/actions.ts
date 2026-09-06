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
    // El seudónimo es del aporte, no del contribuyente: "Familia Pérez"
    // en el recibo, Juan Pérez en el libro. Sin contribuyente no tiene
    // sentido y se descarta.
    receipt_name: contributorId ? str(formData, "receipt_name") || null : null,
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
 *
 * Registra también QUIÉN lo emitió: ese nombre va en la firma de la
 * copia que el creyente baja desde "Mis aportes" (my_receipt, 046).
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

  if (error) return fail(error.message);

  revalidatePath("/admin/tesoreria/libro");
  return ok;
}
