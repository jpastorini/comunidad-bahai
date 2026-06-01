import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";

// ─── Dominio: días, horas y niveles ──────────────────────────────
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

// ─── Mi disponibilidad (patrón recurrente) ───────────────────────

export type MyAvailability = Record<string, AvailabilityLevel>;

/**
 * Devuelve mi grilla recurrente como mapa { "weekday:hour" → level }.
 * Solo el patrón semanal (event_date IS NULL).
 */
export async function getMyAvailability(
  userId: string
): Promise<MyAvailability> {
  if (!isSupabaseConfigured()) return {};
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("availability_slots")
    .select("weekday, hour, level")
    .eq("user_id", userId)
    .is("event_date", null);
  if (error) {
    console.error("[getMyAvailability] error:", error);
    return {};
  }
  const map: MyAvailability = {};
  for (const r of (data ?? []) as Array<{
    weekday: number;
    hour: number;
    level: AvailabilityLevel;
  }>) {
    map[cellKey(r.weekday, r.hour)] = r.level;
  }
  return map;
}

// ─── Consolidado de la localidad ─────────────────────────────────

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

/**
 * Consolidado para el heatmap del equipo: el patrón recurrente de todos
 * los miembros de la AEL de la localidad, agregado por celda. Incluye la
 * lista de miembros para poder mostrar quién todavía no cargó.
 */
export async function getLocalityAvailability(
  localityId: string
): Promise<LocalityAvailability> {
  const empty: LocalityAvailability = {
    members: [],
    filledMemberIds: [],
    cells: {},
  };
  if (!isSupabaseConfigured()) return empty;
  const supabase = createSupabaseServer();

  const [membersRes, slotsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("locality_id", localityId)
      .eq("role", "admin")
      .order("full_name", { ascending: true }),
    supabase
      .from("availability_slots")
      .select("user_id, weekday, hour, level")
      .eq("locality_id", localityId)
      .is("event_date", null),
  ]);

  const members: AvailabilityMember[] = (
    (membersRes.data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>
  ).map((m) => ({
    id: m.id,
    name: m.full_name?.trim() || m.email?.split("@")[0] || "Miembro",
  }));
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const cells: Record<string, CellEntry[]> = {};
  const filled = new Set<string>();
  for (const r of (slotsRes.data ?? []) as Array<{
    user_id: string;
    weekday: number;
    hour: number;
    level: AvailabilityLevel;
  }>) {
    filled.add(r.user_id);
    const key = cellKey(r.weekday, r.hour);
    (cells[key] ??= []).push({
      userId: r.user_id,
      name: nameById.get(r.user_id) ?? "Miembro",
      level: r.level,
    });
  }

  return { members, filledMemberIds: Array.from(filled), cells };
}

/**
 * Contador liviano para el tile del panel: cuántos miembros de la AEL ya
 * cargaron alguna franja, sobre el total. No trae la grilla completa.
 */
export async function getAvailabilityFillStats(
  localityId: string
): Promise<{ filled: number; total: number }> {
  if (!isSupabaseConfigured()) return { filled: 0, total: 0 };
  const supabase = createSupabaseServer();
  const [membersRes, slotsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("locality_id", localityId)
      .eq("role", "admin"),
    supabase
      .from("availability_slots")
      .select("user_id")
      .eq("locality_id", localityId)
      .is("event_date", null),
  ]);
  const filled = new Set(
    ((slotsRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
  );
  return { filled: filled.size, total: membersRes.count ?? 0 };
}
