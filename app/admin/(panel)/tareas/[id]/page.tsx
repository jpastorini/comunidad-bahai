import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { AssemblyTask } from "@/lib/tasks";
import { TaskForm } from "../task-form";

export default async function EditarTareaPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("assembly_tasks")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const task = data as AssemblyTask;

  return (
    <FormShell>
      <PageHeader
        eyebrow="Tareas de la Asamblea"
        title="Editar tarea"
        description="Modificá los datos de la tarea o cambiá su estado."
      />
      <TaskForm task={task} />
    </FormShell>
  );
}
