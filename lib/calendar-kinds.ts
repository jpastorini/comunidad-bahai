import { colors } from "./tokens";

/**
 * Categoría visual de un evento del calendario.
 * - fiesta_19_dias y los días sagrados se siembran automáticamente
 *   (Step 2 y Step 3 — ver migraciones 014 / 015).
 * - actividad_general es la categoría por defecto cuando una Asamblea
 *   crea un evento manualmente desde el panel admin.
 */
export type CalendarEventKind =
  | "fiesta_19_dias"
  | "dia_sagrado_no_trabajo"
  | "dia_sagrado_con_trabajo"
  | "actividad_general";

export type CalendarKindMeta = {
  id: CalendarEventKind;
  label: string;
  short: string;
  color: string;
};

export const CALENDAR_KINDS: Record<CalendarEventKind, CalendarKindMeta> = {
  fiesta_19_dias: {
    id: "fiesta_19_dias",
    label: "Fiesta de los Diecinueve Días",
    short: "Fiesta 19",
    color: colors.gold,
  },
  dia_sagrado_no_trabajo: {
    id: "dia_sagrado_no_trabajo",
    label: "Día Sagrado · no se trabaja",
    short: "Día Sagrado",
    color: colors.terra,
  },
  dia_sagrado_con_trabajo: {
    id: "dia_sagrado_con_trabajo",
    label: "Día Sagrado · se trabaja",
    short: "Día Sagrado",
    color: colors.amber,
  },
  actividad_general: {
    id: "actividad_general",
    label: "Actividad general",
    short: "Actividad",
    color: colors.green,
  },
};

export function getCalendarKind(
  kind: string | null | undefined
): CalendarKindMeta {
  if (!kind) return CALENDAR_KINDS.actividad_general;
  return (
    CALENDAR_KINDS[kind as CalendarEventKind] ?? CALENDAR_KINDS.actividad_general
  );
}

/**
 * Color efectivo del evento: para actividad_general, el color es
 * elegido por la Asamblea (campo color de la fila). Para el resto,
 * el color es el canónico de la categoría.
 */
export function effectiveEventColor(
  kind: string | null | undefined,
  fallbackColor: string
): string {
  const meta = getCalendarKind(kind);
  if (meta.id === "actividad_general") return fallbackColor || meta.color;
  return meta.color;
}
