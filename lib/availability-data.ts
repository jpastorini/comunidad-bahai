import "server-only";

import { activeMembers, getLocalityMembers } from "./memberships";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import {
  cellKey,
  type AvailabilityLevel,
  type AvailabilityMember,
  type LocalityAvailability,
  type MyAvailability,
} from "./availability";

// Lecturas de disponibilidad que tocan la base (Supabase + RLS). Separadas
// del dominio (`lib/availability.ts`) para que ese módulo lo puedan importar
// los Client Components sin arrastrar `next/headers`.

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

  // Por MEMBRESÍA (056): el rol de Asamblea es el de ESTA comunidad, no
  // el del sombrero que la persona tenga puesto. Y la grilla es de la
  // PERSONA (082), no de la localidad con que la cargó: se busca por
  // quiénes integran esta institución, así la misma grilla sirve en su
  // AEL, en la Nacional y en cada estructura.
  const roster = await getLocalityMembers(supabase, localityId);
  const adminIds = roster.filter((m) => m.role === "admin").map((m) => m.id);
  const slotsRes = await supabase
    .from("availability_slots")
    .select("user_id, weekday, hour, level")
    .in("user_id", adminIds)
    .is("event_date", null);

  const members: AvailabilityMember[] = roster
    .filter((m) => m.role === "admin")
    .map((m) => ({
      id: m.id,
      name: m.full_name?.trim() || m.email?.split("@")[0] || "Miembro",
    }));
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const cells: LocalityAvailability["cells"] = {};
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
): Promise<{ filled: number; total: number; missing: string[] }> {
  if (!isSupabaseConfigured()) return { filled: 0, total: 0, missing: [] };
  const supabase = createSupabaseServer();
  // Con nombre, para que el Inicio del panel diga a QUIÉN falta: un
  // "5 de 9" solo no le dice a nadie a quién recordarle. Por membresía y
  // con el rol de esta comunidad (056); la grilla, por persona (082).
  const roster = await getLocalityMembers(supabase, localityId);
  const members = activeMembers(roster).filter((m) => m.role === "admin");
  const slotsRes = await supabase
    .from("availability_slots")
    .select("user_id")
    .in("user_id", members.map((m) => m.id))
    .is("event_date", null);
  const filled = new Set(
    ((slotsRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
  );
  const missing = members
    .filter((m) => !filled.has(m.id))
    .map((m) => m.full_name?.trim() || "Sin nombre");
  // `filled` cuenta solo miembros vigentes: alguien que cargó y después
  // dejó la Asamblea no suma.
  const filledCurrent = members.filter((m) => filled.has(m.id)).length;
  return { filled: filledCurrent, total: members.length, missing };
}
