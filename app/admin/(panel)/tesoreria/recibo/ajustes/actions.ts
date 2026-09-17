"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { isSchemaMissing } from "@/lib/polls-shared";
import { isReceiptTheme } from "@/lib/receipt-theme";
import { RECEIPT_SIGNATURE_BUCKET } from "@/lib/receipt-settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Los ajustes del recibo (060): quién firma, con qué imagen y en qué
 * color. Detrás del tag `can_manage_treasury`, como el libro.
 *
 * ⚠️ La firma NO viaja adentro del formulario: la sube el navegador
 * directo al bucket y acá llega solo la ruta, que se vuelve a verificar.
 * Es la misma regla que los estatutos (052) y por el mismo motivo: en
 * Vercel una petición a una función no puede pasar de 4,5 MB, y cuando el
 * archivo la hacía rebotar se perdía el formulario ENTERO sin aviso. Un
 * escaneo de firma pesa poco, pero "poco" depende de con qué lo escaneen.
 */

const PAGE = "/admin/tesoreria/recibo/ajustes";

const SIGNATURE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function fail(message: string): never {
  setFlashToast({ tone: "error", message });
  redirect(PAGE);
}

function done(message: string): never {
  setFlashToast({ tone: "success", message });
  revalidatePath(PAGE);
  // El recibo en sí se arma en otra ruta y el caché del router guarda las
  // pantallas visitadas: sin esto, el tesorero cambia el tema y el recibo
  // que ya tenía abierto sigue saliendo del color anterior.
  revalidatePath("/admin/tesoreria/recibo", "layout");
  redirect(PAGE);
}

/** Borra el archivo viejo del bucket. Se llama DESPUÉS de guardar la
 *  fila: si falla, queda un huérfano (barato) y no un recibo apuntando a
 *  una imagen que ya no está (caro). */
async function removeSignatureFile(
  supabase: ReturnType<typeof createSupabaseServer>,
  path: string | null
) {
  if (!path) return;
  const { error } = await supabase.storage.from(RECEIPT_SIGNATURE_BUCKET).remove([path]);
  if (error) console.error("[removeSignatureFile]", error);
}

export async function saveReceiptSettingsAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const theme = str(formData, "theme") || "terracota";
  if (!isReceiptTheme(theme)) fail("Ese tema de color no existe.");

  const { data: current } = await supabase
    .from("treasury_receipt_settings")
    .select("signature_path")
    .eq("locality_id", localityId)
    .maybeSingle();
  const previousPath =
    (current as { signature_path: string | null } | null)?.signature_path ?? null;

  const payload: Record<string, unknown> = {
    locality_id: localityId,
    // Vacío = se resuelve desde la composición de la Asamblea (052). El
    // campo es un override, no la fuente: ver la migración 060.
    treasurer_name: str(formData, "treasurer_name").slice(0, 120) || null,
    treasurer_title: str(formData, "treasurer_title").slice(0, 80) || null,
    theme,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  };

  const removing = formData.get("remove_signature") === "on";
  const newPath = str(formData, "signature_path");
  let toDelete: string | null = null;

  if (removing && !newPath) {
    payload.signature_path = null;
    payload.signature_file_name = null;
    payload.signature_uploaded_at = null;
    toDelete = previousPath;
  } else if (newPath) {
    const prefix = `${localityId}/firma/`;
    const lower = newPath.toLowerCase();
    if (!newPath.startsWith(prefix) || !SIGNATURE_EXTS.some((e) => lower.endsWith(e))) {
      fail("La ruta de la firma no es válida.");
    }
    payload.signature_path = newPath;
    payload.signature_file_name = str(formData, "signature_file_name").slice(0, 200) || "firma.png";
    payload.signature_uploaded_at = new Date().toISOString();
    // Subir otra reemplaza a la anterior, como los estatutos.
    if (previousPath && previousPath !== newPath) toDelete = previousPath;
  }

  const { error } = await supabase
    .from("treasury_receipt_settings")
    .upsert(payload, { onConflict: "locality_id" });

  if (error) {
    console.error("[saveReceiptSettingsAction]", error);
    fail(
      isSchemaMissing(error.code)
        ? "Falta aplicar la migración 060 en Supabase."
        : "No se pudieron guardar los ajustes del recibo."
    );
  }

  await removeSignatureFile(supabase, toDelete);
  done("Listo. El recibo sale con estos datos.");
}
