import { Button, Card, Field, Select, TextArea, TextInput } from "@/components/admin/ui";
import type { AssemblyTask } from "@/lib/tasks";
import { upsertTaskAction } from "./actions";

/** Form de alta/edición manual de una tarea. */
export function TaskForm({ task }: { task?: AssemblyTask }) {
  return (
    <form action={upsertTaskAction}>
      {task && <input type="hidden" name="id" value={task.id} />}

      <Card>
        <Field label="Descripción" name="description" required>
          <TextArea
            id="description"
            name="description"
            rows={3}
            required
            defaultValue={task?.description ?? ""}
            placeholder="Ej. Enviar carta de bienvenida a la familia nueva"
          />
        </Field>

        <div className="mt-4">
          <Field
            label="Responsable"
            name="assignee"
            hint="Opcional — quién la lleva adelante"
          >
            <TextInput
              id="assignee"
              name="assignee"
              defaultValue={task?.assignee ?? ""}
              placeholder="Nombre del miembro o comité"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Prioridad" name="priority">
            <Select
              id="priority"
              name="priority"
              defaultValue={task?.priority ?? "media"}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </Select>
          </Field>

          <Field label="Estado" name="status">
            <Select
              id="status"
              name="status"
              defaultValue={task?.status ?? "por_hacer"}
            >
              <option value="por_hacer">Por hacer</option>
              <option value="en_progreso">En progreso</option>
              <option value="hecha">Hecha</option>
            </Select>
          </Field>

          <Field label="Fecha límite" name="due_date" hint="Opcional">
            <TextInput
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={task?.due_date ?? ""}
            />
          </Field>
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" href="/admin/tareas">
          Cancelar
        </Button>
        <Button type="submit">
          {task ? "Guardar cambios" : "Crear tarea"}
        </Button>
      </div>
    </form>
  );
}
