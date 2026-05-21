"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Crea o actualiza el compromiso mensual del miembro logueado.
 * El miembro solo puede tener un compromiso vigente — re-enviar el form
 * sobreescribe el anterior (upsert por user_id).
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

  const { error } = await supabase
    .from("treasury_commitments")
    .upsert({
      user_id: session.user.id,
      display_name,
      amount,
      want_reminder,
    });

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Compromiso guardado. Gracias." }
  );

  revalidatePath("/tesoreria");
  revalidatePath("/admin/tesoreria");
  redirect("/tesoreria");
}

export async function deleteCommitmentAction() {
  const session = await requireMember("/tesoreria");
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("treasury_commitments")
    .delete()
    .eq("user_id", session.user.id);

  setFlashToast(
    error
      ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
      : { tone: "success", message: "Compromiso eliminado." }
  );

  revalidatePath("/tesoreria");
  revalidatePath("/admin/tesoreria");
  redirect("/tesoreria");
}
