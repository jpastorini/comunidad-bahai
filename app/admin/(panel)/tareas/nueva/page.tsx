import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { TaskForm } from "../task-form";

export default async function NuevaTareaPage() {
  await requireAdmin();
  return (
    <FormShell>
      <PageHeader
        eyebrow="Tareas de la Asamblea"
        title="Nueva tarea"
        description="Cargá una tarea a mano. Más adelante también vas a poder importarlas desde el acta de la reunión."
      />
      <TaskForm />
    </FormShell>
  );
}
