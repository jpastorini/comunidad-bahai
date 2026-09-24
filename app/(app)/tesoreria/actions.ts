"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Crea o actualiza el compromiso mensual del creyente logueado con el
 * Fondo de la comunidad que tiene puesta.
 *
 * Desde la 063 la clave es (user_id, locality_id): quien pertenece a su
 * AEL y a la Comunidad Nacional puede sostener uno con cada Fondo, y el
 * upsert tiene que decirlo o el segundo pisaría al primero.
 */
export async function upsertCommitmentAction(formData: FormData) {
  const session = await requireMember("/tesoreria");
  const supabase = createSupabaseServer();

  const display_name = ((formData.get("display_name") as string) || "").trim();
  const amountRaw = ((formData.get("amount") as string) || "").trim();
  const amount = parseFloat(amountRaw.replace(",", "."));
  const want_reminder = formData.get("want_reminder") === "on";

  if (!display_name) {
    setFlashToast({ tone: "error", message: "Ingresa un nombre." });
    redirect("/tesoreria");
  }
  if (!isFinite(amount) || amount <= 0) {
    setFlashToast({ tone: "error", message: "El monto debe ser mayor que 0." });
    redirect("/tesoreria");
  }

  const { error } = await supabase.from("treasury_commitments").upsert(
    {
      user_id: session.user.id,
      locality_id: session.locality.id,
      display_name,
      amount,
      currency: "UYU",
      want_reminder,
    },
    { onConflict: "user_id,locality_id" }
  );

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Compromiso guardado. Gracias." }
  );

  revalidatePath("/tesoreria");
  revalidatePath("/admin/tesoreria/compromisos");
  redirect("/tesoreria");
}

export async function deleteCommitmentAction() {
  const session = await requireMember("/tesoreria");
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("treasury_commitments")
    .delete()
    .eq("user_id", session.user.id)
    .eq("locality_id", session.locality.id);

  setFlashToast(
    error
      ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
      : { tone: "success", message: "Compromiso eliminado." }
  );

  revalidatePath("/tesoreria");
  revalidatePath("/admin/tesoreria/compromisos");
  redirect("/tesoreria");
}
