"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { INSTITUTION_DOCS_BUCKET } from "@/lib/institution";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

const BACK = "/admin/actas";

/**
 * Las actas de la institución puesta —una Asamblea o una estructura— con
 * su archivo (084). La RLS de `assembly_actas` (031) acota a la localidad
 * puesta; el archivo lo subió el navegador y acá solo se acepta si está en
 * la carpeta de esta localidad.
 */
export async function saveActaAction(fd: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const id = ((fd.get("id") as string) || "").trim();
  const title = ((fd.get("title") as string) || "").trim();
  const date = ((fd.get("meeting_date") as string) || "").trim();

  if (!title) {
    setFlashToast({ tone: "error", message: "Poné un título al acta." });
    redirect(BACK);
  }

  const payload: Record<string, unknown> = {
    title,
    meeting_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    notes: ((fd.get("notes") as string) || "").trim() || null,
  };
  const filePath = ((fd.get("file_path") as string) || "").trim();
  if (filePath) {
    if (!filePath.startsWith(`${session.locality.id}/actas/`)) {
      setFlashToast({ tone: "error", message: "Archivo inválido." });
      redirect(BACK);
    }
    payload.file_path = filePath;
    payload.file_name = ((fd.get("file_name") as string) || "acta").trim();
  }

  let previousFile: string | null = null;
  if (id) {
    const { data: prev } = await supabase
      .from("assembly_actas")
      .select("file_path")
      .eq("id", id)
      .maybeSingle();
    previousFile = (prev as { file_path?: string | null } | null)?.file_path ?? null;
  }

  const { error } = id
    ? await supabase.from("assembly_actas").update(payload).eq("id", id)
    : await supabase.from("assembly_actas").insert({
        ...payload,
        locality_id: session.locality.id,
        scope: "local",
        created_by: session.user.id,
      });
  if (error) {
    setFlashToast({
      tone: "error",
      message:
        error.code === "42703" || error.code === "PGRST204"
          ? "Falta aplicar la migración 084 en la base."
          : `No se pudo guardar: ${error.message}`,
    });
    redirect(BACK);
  }

  if (filePath && previousFile && previousFile !== filePath) {
    await supabase.storage.from(INSTITUTION_DOCS_BUCKET).remove([previousFile]);
  }

  setFlashToast({ tone: "success", message: id ? "Acta actualizada." : "Acta guardada." });
  revalidatePath(BACK);
  redirect(BACK);
}

export async function deleteActaAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = ((fd.get("id") as string) || "").trim();
  // Las tareas que salieron del acta se quedan (la FK pone NULL).
  const { data } = await supabase
    .from("assembly_actas")
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle();
  const file = (data as { file_path?: string | null } | null)?.file_path;
  if (file) await supabase.storage.from(INSTITUTION_DOCS_BUCKET).remove([file]);

  setFlashToast({ tone: "success", message: "Acta eliminada. Sus tareas siguen en Tareas." });
  revalidatePath(BACK);
  redirect(BACK);
}
