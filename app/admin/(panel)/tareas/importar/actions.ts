"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  extractDocxText,
  extractTasksFromText,
  type ExtractedTask,
} from "@/lib/acta-extract";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isTaskPriority } from "@/lib/tasks";
import { setFlashToast } from "@/lib/toast";

export type ImportPreview = {
  ok: boolean;
  error?: string;
  tasks?: ExtractedTask[];
};

/**
 * Paso 1: recibe el .docx, extrae el texto en memoria y le pide a Claude la
 * lista de tareas. NO guarda nada (ni el binario ni el acta): solo devuelve
 * la propuesta para que el secretario la revise y edite en el preview.
 */
export async function extractTasksFromActaAction(
  formData: FormData
): Promise<ImportPreview> {
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "Subí el archivo .docx del acta." };
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".docx")) {
    return {
      ok: false,
      error: "El archivo debe ser un .docx (Word). El formato viejo .doc no sirve.",
    };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "El archivo es muy grande (máx. 10 MB)." };
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractDocxText(buffer);
  } catch {
    return {
      ok: false,
      error: "No se pudo leer el .docx. ¿Está dañado o protegido?",
    };
  }

  return extractTasksFromText(text);
}

type SavePayload = {
  title: string;
  meetingDate: string | null;
  tasks: ExtractedTask[];
};

/**
 * Paso 2: el secretario confirma. Creamos UN registro de acta (solo metadata:
 * título + fecha, NO el binario) e insertamos las tareas enlazadas a esa acta.
 * Sigue el mismo patrón de inserción que upsertTaskAction.
 */
export async function saveImportedTasksAction(
  payload: SavePayload
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const title = payload.title.trim();
  if (!title) {
    return { ok: false, error: "Ponele un título al acta." };
  }

  const tasks = (payload.tasks ?? [])
    .map((t) => ({
      description: (t.description ?? "").trim(),
      assignee: t.assignee?.trim() || null,
      priority: isTaskPriority(t.priority) ? t.priority : "media",
      due_date:
        typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)
          ? t.due_date
          : null,
    }))
    .filter((t) => t.description.length > 0);

  if (tasks.length === 0) {
    return { ok: false, error: "No hay tareas para guardar." };
  }

  // 1) Crear el acta (solo metadata).
  const { data: acta, error: actaError } = await supabase
    .from("assembly_actas")
    .insert({
      scope: "local",
      title,
      meeting_date: payload.meetingDate || null,
      locality_id: session.locality.id,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (actaError || !acta) {
    return {
      ok: false,
      error: `No se pudo crear el acta: ${actaError?.message ?? "error desconocido"}`,
    };
  }

  // 2) Insertar las tareas enlazadas al acta.
  const now = new Date().toISOString();
  const rows = tasks.map((t) => ({
    ...t,
    status: "por_hacer" as const,
    scope: "local" as const,
    acta_id: acta.id,
    locality_id: session.locality.id,
    created_by: session.user.id,
    updated_at: now,
  }));

  const { error: tasksError } = await supabase
    .from("assembly_tasks")
    .insert(rows);

  if (tasksError) {
    return {
      ok: false,
      error: `Se creó el acta pero fallaron las tareas: ${tasksError.message}`,
    };
  }

  setFlashToast({
    tone: "success",
    message: `Acta importada: ${rows.length} tarea${rows.length === 1 ? "" : "s"} agregada${rows.length === 1 ? "" : "s"}.`,
  });
  revalidatePath("/admin/tareas");
  return { ok: true };
}
