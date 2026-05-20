"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Inserta múltiples sugerencias para una misma Fiesta de una sola vez.
 * Útil cuando la Asamblea recoge sugerencias en papel/whatsapp/verbal
 * durante la Fiesta y las captura todas juntas.
 */
export async function bulkInsertSuggestionsAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const feast_id = formData.get("feast_id") as string;
  if (!feast_id) {
    setFlashToast({ tone: "error", message: "Selecciona una Fiesta." });
    redirect("/admin/sugerencias/nueva");
  }

  const details = formData.getAll("detail[]") as string[];
  const authors = formData.getAll("author_name[]") as string[];

  const rows = details
    .map((d, i) => ({
      feast_id,
      detail: (d || "").trim(),
      author_name: (authors[i] || "").trim() || null,
      // user_id queda NULL para capturas manuales por admin.
    }))
    .filter((r) => r.detail.length > 0);

  if (rows.length === 0) {
    setFlashToast({ tone: "error", message: "No se ingresó ninguna sugerencia." });
    redirect("/admin/sugerencias/nueva");
  }

  const { error } = await supabase.from("feast_suggestions").insert(rows);

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : {
          tone: "success",
          message: `${rows.length} ${
            rows.length === 1 ? "sugerencia agregada" : "sugerencias agregadas"
          }.`,
        }
  );

  revalidatePath("/admin/sugerencias");
  revalidatePath(`/admin/fiestas/${feast_id}`);
  redirect("/admin/sugerencias");
}

/**
 * Captura rápida de una sola sugerencia — usado durante la Fiesta cuando
 * el secretario está tomando nota en su teléfono. Vuelve a la misma URL
 * para que el form re-aparezca con foco listo para la siguiente.
 */
export async function quickAddSuggestionAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const feast_id = formData.get("feast_id") as string;
  const detail = ((formData.get("detail") as string) || "").trim();
  const author_name =
    ((formData.get("author_name") as string) || "").trim() || null;

  if (!feast_id) redirect("/admin/sugerencias");
  if (!detail) {
    redirect(`/admin/fiestas/${feast_id}/sugerencias?error=empty`);
  }

  const { error } = await supabase.from("feast_suggestions").insert({
    feast_id,
    detail,
    author_name,
  });

  if (error) {
    setFlashToast({ tone: "error", message: `Error: ${error.message}` });
  }
  // No mostramos toast en éxito: el feedback visual es que la sugerencia
  // aparece arriba de la lista y el form se limpia.

  revalidatePath(`/admin/fiestas/${feast_id}/sugerencias`);
  revalidatePath("/admin/sugerencias");
  redirect(`/admin/fiestas/${feast_id}/sugerencias`);
}

/** Marca o desmarca una sugerencia como "tratada por la Asamblea". */
export async function toggleSuggestionReviewedAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string;
  const nextReviewed = formData.get("reviewed") === "true";

  if (!id) redirect("/admin/sugerencias");

  await supabase
    .from("feast_suggestions")
    .update({ reviewed: nextReviewed })
    .eq("id", id);

  revalidatePath("/admin/sugerencias");
}

export async function deleteSuggestionAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase
      .from("feast_suggestions")
      .delete()
      .eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Sugerencia borrada." }
    );
  }
  revalidatePath("/admin/sugerencias");
}
