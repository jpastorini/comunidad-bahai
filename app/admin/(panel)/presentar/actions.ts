"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { INSTITUTION_DOCS_BUCKET } from "@/lib/institution";
import { getLocalityAdminIds, sendPushToUsers } from "@/lib/push";
import { isStructureReportsSchemaMissing } from "@/lib/structure-reports";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import { isStructureLocality } from "@/lib/types";

const BACK = "/admin/presentar";

/**
 * Lo que una estructura (082) le presenta a la Asamblea que la creó (084).
 * Escribe con el cliente de quien está parado en la estructura: la RLS
 * deja tocar solo los informes propios y nunca aprobarlos.
 */
async function requireStructure() {
  const session = await requireAdmin();
  if (!isStructureLocality(session.locality)) redirect("/admin/informes");
  return session;
}

function fail(message: string, to = BACK): never {
  setFlashToast({ tone: "error", message });
  redirect(to);
}

function dbFail(code: string | undefined, message: string, to = BACK): never {
  if (isStructureReportsSchemaMissing(code)) fail("Falta aplicar la migración 084 en la base.", to);
  fail(`No se pudo guardar: ${message}`, to);
}

function text(fd: FormData, key: string): string {
  return ((fd.get(key) as string) || "").trim();
}

function isoOrNull(fd: FormData, key: string): string | null {
  const v = text(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Avisa a la Asamblea madre que hay un informe para mirar. */
async function notifyParent(parentId: string, structureName: string, reportId: string, title: string) {
  const ids = await getLocalityAdminIds(parentId);
  await sendPushToUsers(ids, {
    title: `${structureName} presentó un informe`,
    body: title,
    url: `/admin/informes/presentados/${reportId}`,
    tag: `presentado-${reportId}`,
  });
}

export async function saveActivityReportAction(fd: FormData) {
  const session = await requireStructure();
  const supabase = createSupabaseServer();
  const id = text(fd, "id");
  const back = id ? `${BACK}/${id}` : `${BACK}/nuevo`;

  const title = text(fd, "title");
  if (!title) fail("Poné un título al informe.", back);

  const payload: Record<string, unknown> = {
    title,
    period_from: isoOrNull(fd, "period_from"),
    period_to: isoOrNull(fd, "period_to"),
    body: text(fd, "body") || null,
  };

  // El archivo lo subió el navegador; se acepta solo si está en la
  // carpeta de esta estructura.
  const filePath = text(fd, "file_path");
  if (filePath) {
    if (!filePath.startsWith(`${session.locality.id}/informes/`)) fail("Archivo inválido.", back);
    payload.file_path = filePath;
    payload.file_name = text(fd, "file_name") || "archivo";
  }

  let previousFile: string | null = null;
  let savedId = id;
  if (id) {
    const { data: prev } = await supabase
      .from("structure_reports")
      .select("file_path")
      .eq("id", id)
      .maybeSingle();
    previousFile = (prev as { file_path: string | null } | null)?.file_path ?? null;
    const { error } = await supabase
      .from("structure_reports")
      .update(payload)
      .eq("id", id)
      .eq("status", "borrador");
    if (error) dbFail(error.code, error.message, back);
  } else {
    const { data, error } = await supabase
      .from("structure_reports")
      .insert({
        ...payload,
        structure_id: session.locality.id,
        kind: "actividad",
        status: "borrador",
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) dbFail(error.code, error.message, back);
    savedId = (data as { id: string }).id;
  }

  // El archivo anterior se borra recién cuando la fila ya no lo nombra.
  if (filePath && previousFile && previousFile !== filePath) {
    await supabase.storage.from(INSTITUTION_DOCS_BUCKET).remove([previousFile]);
  }

  setFlashToast({ tone: "success", message: "Borrador guardado. Presentalo cuando esté listo." });
  revalidatePath(BACK);
  redirect(`${BACK}/${savedId}`);
}

export async function presentReportAction(fd: FormData) {
  const session = await requireStructure();
  const supabase = createSupabaseServer();
  const id = text(fd, "id");

  const { data, error } = await supabase
    .from("structure_reports")
    .update({ status: "presentado" })
    .eq("id", id)
    .eq("status", "borrador")
    .select("id, parent_id, title")
    .maybeSingle();
  if (error) dbFail(error.code, error.message, `${BACK}/${id}`);
  if (!data) fail("Ese informe ya no se puede presentar.");

  const row = data as { id: string; parent_id: string; title: string };
  await notifyParent(row.parent_id, session.locality.name, row.id, row.title);

  setFlashToast({ tone: "success", message: "Informe presentado. La Asamblea recibió el aviso." });
  revalidatePath(BACK);
  redirect(BACK);
}

export async function withdrawReportAction(fd: FormData) {
  await requireStructure();
  const supabase = createSupabaseServer();
  const id = text(fd, "id");
  // La RLS no deja tocar uno aprobado.
  const { data, error } = await supabase
    .from("structure_reports")
    .update({ status: "borrador" })
    .eq("id", id)
    .eq("status", "presentado")
    .select("id, kind")
    .maybeSingle();
  if (error) dbFail(error.code, error.message);
  if (!data) fail("Ese informe ya fue aprobado: no se puede retirar.");

  // Uno de Tesorería no tiene borrador propio: retirarlo es sacarlo.
  if ((data as { kind: string }).kind === "tesoreria") {
    await supabase.from("structure_reports").delete().eq("id", id);
  }

  setFlashToast({ tone: "success", message: "Informe retirado." });
  revalidatePath(BACK);
  redirect(BACK);
}

export async function deleteReportAction(fd: FormData) {
  await requireStructure();
  const supabase = createSupabaseServer();
  const id = text(fd, "id");
  const { data } = await supabase
    .from("structure_reports")
    .delete()
    .eq("id", id)
    .eq("status", "borrador")
    .select("file_path")
    .maybeSingle();
  const file = (data as { file_path: string | null } | null)?.file_path;
  if (file) await supabase.storage.from(INSTITUTION_DOCS_BUCKET).remove([file]);

  setFlashToast({ tone: "success", message: "Borrador eliminado." });
  revalidatePath(BACK);
  redirect(BACK);
}

/** Presenta una hoja de Tesorería ya emitida: no se copia, se apunta. */
export async function presentTreasuryReportAction(fd: FormData) {
  const session = await requireStructure();
  if (!session.profile.can_manage_treasury) {
    fail("Los informes de Tesorería los presenta quien lleva la Tesorería.");
  }
  const supabase = createSupabaseServer();
  const reportId = text(fd, "treasury_report_id");

  const { data: report } = await supabase
    .from("treasury_reports")
    .select("id, title, period_from, period_to, status, locality_id")
    .eq("id", reportId)
    .maybeSingle();
  const r = report as {
    id: string;
    title: string;
    period_from: string;
    period_to: string;
    status: string;
    locality_id: string;
  } | null;
  if (!r || r.locality_id !== session.locality.id) fail("Ese informe no es de esta estructura.");
  if (r.status !== "published") fail("Primero hay que emitirlo, en Tesorería → Informes.");

  const { data, error } = await supabase
    .from("structure_reports")
    .insert({
      structure_id: session.locality.id,
      kind: "tesoreria",
      treasury_report_id: r.id,
      title: r.title,
      period_from: r.period_from,
      period_to: r.period_to,
      status: "presentado",
      created_by: session.user.id,
    })
    .select("id, parent_id")
    .single();
  if (error) {
    if (error.code === "23505") fail("Ese informe ya está presentado.");
    dbFail(error.code, error.message);
  }

  const row = data as { id: string; parent_id: string };
  await notifyParent(row.parent_id, session.locality.name, row.id, r.title);

  setFlashToast({ tone: "success", message: "Informe de Tesorería presentado." });
  revalidatePath(BACK);
  redirect(BACK);
}
