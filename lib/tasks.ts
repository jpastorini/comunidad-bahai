/**
 * Tipos y constantes del tablero de tareas de la Asamblea.
 * La data vive en las tablas assembly_tasks / assembly_actas (migración 031).
 */

export type TaskStatus = "por_hacer" | "en_progreso" | "hecha";
export type TaskPriority = "alta" | "media" | "baja";

export type AssemblyTask = {
  id: string;
  locality_id: string | null;
  scope: "local" | "national";
  acta_id: string | null;
  description: string;
  assignee: string | null;
  priority: TaskPriority;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  /** Acta de origen (join), si la tarea se importó de una. */
  acta?: { title: string; meeting_date: string | null } | null;
};

export const STATUS_ORDER: TaskStatus[] = ["por_hacer", "en_progreso", "hecha"];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  por_hacer: { label: "Por hacer", className: "bg-bg text-muted" },
  en_progreso: { label: "En progreso", className: "bg-amber/15 text-amber" },
  hecha: { label: "Hecha", className: "bg-green/15 text-green" },
};

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  alta: { label: "Alta", className: "bg-rose-100 text-rose-700" },
  media: { label: "Media", className: "bg-amber/15 text-amber" },
  baja: { label: "Baja", className: "bg-bg text-muted" },
};

export function isTaskStatus(v: string): v is TaskStatus {
  return v === "por_hacer" || v === "en_progreso" || v === "hecha";
}

export function isTaskPriority(v: string): v is TaskPriority {
  return v === "alta" || v === "media" || v === "baja";
}
