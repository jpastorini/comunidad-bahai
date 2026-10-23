"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireNationalAdmin } from "@/lib/auth";
import { civilDateISO } from "@/lib/citas";
import { addDaysISO, DAILY_READING_TAG } from "@/lib/daily-reading";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const PATH = "/admin/nacional/lectura";

function schemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205" || code === "42703";
}

/** Por ahora solo se carga la de mañana: la fecha la decide el servidor,
 *  no el formulario. */
function tomorrow(): string {
  return addDaysISO(civilDateISO(), 1);
}

export async function saveTomorrowReadingAction(formData: FormData) {
  const session = await requireNationalAdmin();
  const text = ((formData.get("text") as string) || "").trim();
  const reference = ((formData.get("reference") as string) || "").trim();
  const title = ((formData.get("title") as string) || "").trim() || null;

  if (!text || !reference) {
    setFlashToast({ tone: "error", message: "Faltan el texto o la referencia." });
    redirect(PATH);
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.from("daily_reading_overrides").upsert(
    {
      reading_date: tomorrow(),
      text,
      reference,
      title,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "reading_date" }
  );

  setFlashToast(
    error
      ? {
          tone: "error",
          message: schemaMissing(error.code)
            ? "Falta aplicar la migración 081."
            : `Error: ${error.message}`,
        }
      : { tone: "success", message: "Listo: mañana se lee esta cita." }
  );
  revalidateTag(DAILY_READING_TAG);
  revalidatePath(PATH);
  redirect(PATH);
}

export async function clearTomorrowReadingAction() {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("daily_reading_overrides")
    .delete()
    .eq("reading_date", tomorrow());

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: "Mañana vuelve la cita automática." }
  );
  revalidateTag(DAILY_READING_TAG);
  revalidatePath(PATH);
  redirect(PATH);
}
