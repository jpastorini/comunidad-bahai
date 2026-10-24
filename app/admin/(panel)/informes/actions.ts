"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getLocalityAdminIds, sendPushToUsers } from "@/lib/push";
import { isStructureReportsSchemaMissing } from "@/lib/structure-reports";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * La Asamblea registra en qué reunión aprobó un informe que le presentó
 * una de sus estructuras (084). Va por `review_structure_report()`: la
 * estructura escribe su fila, pero no puede aprobarse sola. Fecha vacía
 * deshace la aprobación.
 */
export async function reviewStructureReportAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = ((fd.get("id") as string) || "").trim();
  const date = ((fd.get("approved_on") as string) || "").trim();
  const approvedOn = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const note = ((fd.get("approval_note") as string) || "").trim();
  const back = `/admin/informes/presentados/${id}`;

  const { error } = await supabase.rpc("review_structure_report", {
    p_id: id,
    p_approved_on: approvedOn,
    p_note: note,
  });
  if (error) {
    setFlashToast({
      tone: "error",
      message: isStructureReportsSchemaMissing(error.code)
        ? "Falta aplicar la migración 084 en la base."
        : `No se pudo guardar: ${error.message}`,
    });
    redirect(back);
  }

  // A la estructura le llega que la Asamblea lo aprobó.
  if (approvedOn) {
    const { data } = await supabase
      .from("structure_reports")
      .select("structure_id, title")
      .eq("id", id)
      .maybeSingle();
    const row = data as { structure_id: string; title: string } | null;
    if (row) {
      await sendPushToUsers(await getLocalityAdminIds(row.structure_id), {
        title: "La Asamblea aprobó un informe",
        body: row.title,
        url: `/perfil`,
        tag: `aprobado-${id}`,
      });
    }
  }

  setFlashToast({
    tone: "success",
    message: approvedOn ? "Aprobación registrada." : "Se quitó la aprobación.",
  });
  revalidatePath("/admin/informes");
  redirect(back);
}
