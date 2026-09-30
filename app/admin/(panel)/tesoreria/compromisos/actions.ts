"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { resolveContributor } from "@/lib/treasury-contributor-resolve";
import { formatMoney, parseMoney } from "@/lib/treasury-format";
import { sendPushToUsers } from "@/lib/push";

/**
 * El tesorero registra, corrige y quita compromisos (077): los de quien
 * se lo dijo de palabra en vez de declararlo en la app.
 *
 * La persona se elige con el mismo buscador del Libro y se resuelve a una
 * ficha del padrón con la misma función, así que el compromiso queda
 * colgado de la ficha contra la que después se registran sus aportes. Si
 * esa ficha es de un creyente de la app, el compromiso es además suyo:
 * lo ve en su pantalla, lo puede cambiar, y le llega el aviso del 10.
 */

type Result = { ok: boolean; error: string | null; message?: string };
const fail = (error: string): Result => ({ ok: false, error });

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function revalidate() {
  revalidatePath("/admin/tesoreria/compromisos");
  revalidatePath("/tesoreria");
}

function schemaError(error: { code?: string; message: string }): string {
  if (error.code === "42703" || error.code === "PGRST204" || error.code === "23502") {
    return "Falta aplicar la migración 077 en Supabase.";
  }
  return error.message;
}

export async function saveCommitmentAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const id = str(formData, "id");
  const amount = parseMoney(str(formData, "amount"));
  const currency = str(formData, "currency") === "USD" ? "USD" : "UYU";
  const phone = str(formData, "phone") || null;
  const want_reminder = formData.get("want_reminder") === "on";
  let display_name = str(formData, "display_name");

  if (!isFinite(amount) || amount <= 0) return fail("El monto tiene que ser mayor que cero.");

  // ── Corregir uno que ya existe: la persona no cambia. ──
  if (id) {
    const { data: before } = await supabase
      .from("treasury_commitments")
      .select("user_id, amount, currency, display_name")
      .eq("id", id)
      .eq("locality_id", session.locality.id)
      .maybeSingle();
    if (!before) return fail("Ese compromiso ya no existe.");
    const prev = before as { user_id: string | null; amount: number; currency: string; display_name: string };
    const { error } = await supabase
      .from("treasury_commitments")
      .update({
        display_name: display_name || prev.display_name,
        amount,
        currency,
        phone,
        want_reminder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("locality_id", session.locality.id);
    if (error) return fail(schemaError(error));
    if (Number(prev.amount) !== amount || prev.currency !== currency) {
      await notifyBeliever(prev.user_id, session.user.id, amount, currency, "cambió");
    }
    revalidate();
    return { ok: true, error: null, message: "Compromiso actualizado." };
  }

  // ── Registrar uno nuevo. ──
  let contributorId: string | null;
  try {
    contributorId = await resolveContributor(supabase, formData);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo resolver a la persona.");
  }
  if (!contributorId) return fail("Elegí a la persona.");

  const { data: contributor } = await supabase
    .from("treasury_contributors")
    .select("id, name, profile_id")
    .eq("id", contributorId)
    .maybeSingle();
  const c = contributor as { id: string; name: string; profile_id: string | null } | null;
  if (!c) return fail("No se encontró la ficha de esa persona.");
  const userId = c.profile_id;
  if (!display_name) display_name = c.name;

  // Uno por persona y comunidad: si ya tiene, se corrige ese, no se pisa.
  const dup = await supabase
    .from("treasury_commitments")
    .select("display_name")
    .eq("locality_id", session.locality.id)
    .or(userId ? `contributor_id.eq.${c.id},user_id.eq.${userId}` : `contributor_id.eq.${c.id}`)
    .limit(1);
  if (dup.error) return fail(schemaError(dup.error));
  if ((dup.data ?? []).length > 0) {
    return fail(`${c.name} ya tiene un compromiso: corregilo desde la lista.`);
  }

  const { error } = await supabase.from("treasury_commitments").insert({
    locality_id: session.locality.id,
    user_id: userId,
    contributor_id: c.id,
    display_name,
    amount,
    currency,
    phone,
    want_reminder,
    created_by: session.user.id,
  });
  if (error) return fail(schemaError(error));

  await notifyBeliever(userId, session.user.id, amount, currency, "registró");
  revalidate();
  return {
    ok: true,
    error: null,
    message: userId
      ? `Compromiso registrado. ${c.name} está en la app: lo ve en su Tesorería.`
      : "Compromiso registrado.",
  };
}

export async function deleteCommitmentByTreasurerAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const id = str(formData, "id");
  if (!id) return fail("Falta el compromiso.");
  const { error } = await supabase
    .from("treasury_commitments")
    .delete()
    .eq("id", id)
    .eq("locality_id", session.locality.id);
  if (error) return fail(schemaError(error));
  revalidate();
  return { ok: true, error: null, message: "Compromiso quitado." };
}

/** Al creyente que está en la app, para que sepa y pueda corregir. Un push
 *  que falla no deshace el compromiso. */
async function notifyBeliever(
  userId: string | null,
  treasurerId: string,
  amount: number,
  currency: string,
  verb: "registró" | "cambió"
): Promise<void> {
  if (!userId || userId === treasurerId) return;
  try {
    await sendPushToUsers([userId], {
      title: "Tu compromiso con el Fondo",
      body: `Tesorería ${verb} tu compromiso mensual: ${formatMoney(amount, currency)} por mes. Podés verlo o cambiarlo en Tesorería.`,
      url: "/tesoreria#compromiso",
      tag: "compromiso-registrado",
    });
  } catch (e) {
    console.error("[notifyBeliever]", e);
  }
}
