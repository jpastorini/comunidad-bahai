"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Ocultar y volver a mostrar una tarjeta de atención del Inicio (072).
 *
 * La clave viene con el período o el objeto adentro ("cierre:2026-08"),
 * así que ocultar es acotado: la tarjeta de setiembre aparece igual. No
 * se valida contra la lista de tarjetas vigentes a propósito —una clave
 * que ya no corresponde a nada es inofensiva—, solo su forma.
 */

const KEY_RE = /^[a-z]+:[A-Za-z0-9:_-]{1,80}$/;

function keyOf(formData: FormData): string | null {
  const raw = ((formData.get("key") as string) || "").trim();
  return KEY_RE.test(raw) ? raw : null;
}

export async function hideAttentionAction(formData: FormData) {
  const session = await requireAdmin();
  const key = keyOf(formData);
  if (!key) return;
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("admin_attention_dismissals").upsert(
    {
      user_id: session.user.id,
      locality_id: session.locality.id,
      item_key: key,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,locality_id,item_key" }
  );
  if (error) {
    console.error("[hideAttentionAction]", error);
    setFlashToast({
      tone: "error",
      message:
        error.code === "42P01" || error.code === "PGRST205"
          ? "Falta aplicar la migración 072 en Supabase."
          : "No se pudo ocultar la tarjeta.",
    });
  }
  revalidatePath("/admin");
}

export async function showAttentionAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const key = keyOf(formData);
  let q = supabase
    .from("admin_attention_dismissals")
    .delete()
    .eq("user_id", session.user.id)
    .eq("locality_id", session.locality.id);
  // Sin clave: mostrar todas.
  if (key) q = q.eq("item_key", key);
  const { error } = await q;
  if (error) console.error("[showAttentionAction]", error);
  revalidatePath("/admin");
}
