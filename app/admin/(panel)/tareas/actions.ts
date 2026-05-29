"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isTaskPriority, isTaskStatus } from "@/lib/tasks";
import { setFlashToast } from "@/lib/toast";

export async function upsertTaskAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = (formData.get("id") as string) || null;
  const description = ((formData.get("description") as string) || "").trim();
  const assignee = ((formData.get("assignee") as string) || "").trim() || null;
  const priorityRaw = (formData.get("priority") as string) || "media";
  const statusRaw = (formData.get("status") as string) || "por_hacer";
  const dueDate = (formData.get("due_date") as string) || null;

  if (!description) {
    setFlashToast({ tone: "error", message: "La descripción es obligatoria." });
    redirect("/admin/tareas");
  }

  const priority = isTaskPriority(priorityRaw) ? priorityRaw : "media";
  const status = isTaskStatus(statusRaw) ? statusRaw : "por_hacer";

  const payload = {
    description,
    assignee,
    priority,
    status,
    due_date: dueDate || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("assembly_tasks").update(payload).eq("id", id)
    : await supabase.from("assembly_tasks").insert({
        ...payload,
        scope: "local",
        locality_id: session.locality.id,
        created_by: session.user.id,
      });

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: id ? "Tarea actualizada." : "Tarea creada." }
  );

  revalidatePath("/admin/tareas");
  redirect("/admin/tareas");
}

export async function deleteTaskAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase
      .from("assembly_tasks")
      .delete()
      .eq("id", id);
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Tarea borrada." }
    );
  }
  revalidatePath("/admin/tareas");
}

/** Cambio de estado inline desde el tablero (lo llama StatusControl). */
export async function setTaskStatusAction(id: string, status: string) {
  await requireAdmin();
  if (!isTaskStatus(status)) return;
  const supabase = createSupabaseServer();
  await supabase
    .from("assembly_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/tareas");
}
