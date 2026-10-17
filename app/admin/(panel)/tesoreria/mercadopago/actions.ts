"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { checkToken, isTestToken } from "@/lib/mercadopago";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import { getMpSettings, isMpSchemaMissing } from "@/lib/treasury-online";

const PAGE = "/admin/tesoreria/mercadopago";

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function fail(message: string): never {
  setFlashToast({ tone: "error", message });
  redirect(PAGE);
}

/**
 * Guarda la cuenta de Mercado Pago de la comunidad (079). La tabla no
 * tiene policies: se escribe con service-role DESPUÉS de comprobar el tag
 * de Tesorería, y siempre sobre la comunidad que la persona tiene puesta.
 *
 * Los secretos no vuelven al navegador: el formulario los muestra vacíos,
 * y dejarlos vacíos conserva los guardados.
 */
export async function saveMpSettingsAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const localityId = session.locality.id;
  const db = createSupabaseAdmin();
  if (!db) fail("Falta la clave de servicio en el servidor.");

  const { ready, settings } = await getMpSettings(localityId);
  if (!ready) fail("Falta aplicar la migración 079.");

  const token = str(formData, "access_token") || settings?.access_token || "";
  const secret = str(formData, "webhook_secret") || settings?.webhook_secret || null;
  const enabled = formData.get("enabled") === "on";
  const accountId = str(formData, "account_id") || null;
  const incomeId = str(formData, "income_subcategory_id") || null;
  const feeId = str(formData, "fee_subcategory_id") || null;

  // Los rubros y la cuenta tienen que ser de ESTA comunidad: se leen con
  // el cliente del tesorero, cuya RLS acota a su localidad.
  const supabase = createSupabaseServer();
  if (accountId) {
    const { data } = await supabase.from("treasury_accounts").select("id").eq("id", accountId).maybeSingle();
    if (!data) fail("Esa cuenta no es del libro de esta comunidad.");
  }
  for (const subId of [incomeId, feeId]) {
    if (!subId) continue;
    const { data } = await supabase.from("treasury_subcategories").select("id").eq("id", subId).maybeSingle();
    if (!data) fail("Ese rubro no es del libro de esta comunidad.");
  }

  let nickname: string | null = null;
  if (token && str(formData, "access_token")) {
    const check = await checkToken(token);
    if (!check.ok) fail(`El access token no funciona. ${check.error}`);
    nickname = check.nickname;
  }

  if (enabled && !(token && accountId && incomeId && feeId)) {
    fail("Para habilitar los aportes faltan el access token, la cuenta y los dos rubros.");
  }

  const { error } = await db!.from("treasury_mp_settings").upsert(
    {
      locality_id: localityId,
      enabled,
      access_token: token || null,
      webhook_secret: secret,
      account_id: accountId,
      income_subcategory_id: incomeId,
      fee_subcategory_id: feeId,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "locality_id" }
  );
  if (error) {
    fail(isMpSchemaMissing(error.code) ? "Falta aplicar la migración 079." : error.message);
  }

  setFlashToast({
    tone: "success",
    message: nickname
      ? `Guardado. Cuenta de Mercado Pago: ${nickname}${isTestToken(token) ? " (prueba)" : ""}.`
      : "Guardado.",
  });
  revalidatePath(PAGE);
  revalidatePath("/tesoreria");
  redirect(PAGE);
}
