// Dominio puro de "disponibilidad para reuniones": constantes, tipos y
// helpers SIN dependencias de servidor (Supabase / next/headers). Esto lo
// pueden importar tanto Server Components como Client Components. Las
// lecturas que tocan la base viven en `lib/availability-data.ts`.

// ─── Días, horas y niveles ───────────────────────────────────────
// La semana arranca en lunes (es-UY). weekday: 0=Lun … 6=Dom.

export const WEEKDAYS = [
  { index: 0, short: "Lun", long: "Lunes" },
  { index: 1, short: "Mar", long: "Martes" },
  { index: 2, short: "Mié", long: "Miércoles" },
  { index: 3, short: "Jue", long: "Jueves" },
  { index: 4, short: "Vie", long: "Viernes" },
  { index: 5, short: "Sáb", long: "Sábado" },
  { index: 6, short: "Dom", long: "Domingo" },
] as const;

/** Bloques de 1 h, identificados por su hora de inicio: 08:00 … 21:00. */
export const FIRST_HOUR = 8;
export const LAST_HOUR = 21; // último bloque 21:00–22:00
export const HOURS: number[] = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, i) => FIRST_HOUR + i
);

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Etiqueta del bloque, ej. "08–09". */
export function formatHourRange(hour: number): string {
  return `${String(hour).padStart(2, "0")}–${String(hour + 1).padStart(2, "0")}`;
}

/** 2 = Disponible, 1 = A veces puedo. Ausencia = No puedo. */
export type AvailabilityLevel = 1 | 2;

export const LEVELS: Record<
  AvailabilityLevel,
  { label: string; short: string }
> = {
  2: { label: "Disponible", short: "Sí" },
  1: { label: "A veces puedo", short: "A veces" },
};

/** Clave estable de una celda (día × hora). */
export function cellKey(weekday: number, hour: number): string {
  return `${weekday}:${hour}`;
}

// ─── Tipos de las lecturas (las funciones viven en availability-data) ──

/** Mi grilla recurrente como mapa { "weekday:hour" → level }. */
export type MyAvailability = Record<string, AvailabilityLevel>;

export type AvailabilityMember = { id: string; name: string };

export type CellEntry = {
  userId: string;
  name: string;
  level: AvailabilityLevel;
};

export type LocalityAvailability = {
  /** Todos los miembros de la AEL (role='admin') de la localidad. */
  members: AvailabilityMember[];
  /** IDs de los que ya cargaron al menos una franja. */
  filledMemberIds: string[];
  /** "weekday:hour" → quiénes pueden ahí y con qué nivel. */
  cells: Record<string, CellEntry[]>;
};
