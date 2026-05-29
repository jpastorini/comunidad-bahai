"use client";

import { useTransition } from "react";
import { Select } from "@/components/admin/ui";
import { STATUS_ORDER, STATUS_META, type TaskStatus } from "@/lib/tasks";
import { setTaskStatusAction } from "./actions";

/** Selector de estado que guarda el cambio al instante (sin botón). */
export function StatusControl({
  id,
  status,
}: {
  id: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={status}
      disabled={pending}
      aria-label="Estado de la tarea"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => setTaskStatusAction(id, next));
      }}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
    </Select>
  );
}
