"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: boolean; error: string | null };

const ok: Result = { ok: true, error: null };
const fail = (error: string): Result => ({ ok: false, error });

/** Monto a número, tolerando "1.500,50" y "1500.50". */
function parseAmount(raw: string): number {
  const s = (raw || "").trim();
  if (!s) return NaN;
  // Si hay coma, la coma es el decimal y el punto separa miles.
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Math.round(parseFloat(normalized) * 100) / 100;
}

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

/** Alta o edición de un movimiento. */
export async function saveEntryAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  const entryDate = str(formData, "entry_date");
  const accountId = str(formData, "account_id");
  const subcategoryId = str(formData, "subcategory_id");
  const currency = str(formData, "currency");
  const direction = str(formData, "direction"); // 'ingreso' | 'gasto'
  const amountRaw = parseAmount(str(formData, "amount"));

  if (!entryDate) return fail("Falta la fecha.");
  if (!accountId) return fail("Elegí la cuenta.");
  if (!subcategoryId) return fail("Elegí la subcategoría.");
  if (!["UYU", "USD"].includes(currency)) return fail("Moneda inválida.");
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return fail("El monto tiene que ser mayor a cero.");
  }

  // La categoría no se elige: la manda la subcategoría, como en la
  // planilla. Así no queda un rubro con la categoría cambiada a mano.
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
  const amount = direction === "gasto" ? -amountRaw : amountRaw;

  const receiptRaw = str(formData, "receipt_number");
  const receiptNumber = receiptRaw ? parseInt(receiptRaw, 10) : null;
  if (receiptRaw && Number.isNaN(receiptNumber)) {
    return fail("El número de recibo tiene que ser un número.");
  }

  let contributorId: string | null;
  try {
    contributorId = await resolveContributor(supabase, formData);
  } catch (err) {
    return fail(
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

  const { error } = id
    ? await supabase
        .from("treasury_entries")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
    : await supabase
        .from("treasury_entries")
        .insert({ ...payload, created_by: session.user.id });

  if (error) {
    // El caso frecuente: repetir un número de recibo ya usado.
    if (error.code === "23505" && error.message.includes("receipt")) {
      return fail(
        `El recibo N° ${receiptNumber} ya está usado en otro movimiento.`
      );
    }
    return fail(error.message);
  }

  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria");
  return ok;
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
  const fromAmount = parseAmount(str(formData, "from_amount"));
  const toAmount = parseAmount(str(formData, "to_amount"));

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
