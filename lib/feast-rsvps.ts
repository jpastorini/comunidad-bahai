import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Voy" a la Fiesta (migración 065). La persona ve solo su respuesta; la
 * lista con nombres es de la Asamblea, y la RLS es la que lo sostiene: con
 * el cliente de un creyente, `getFeastRsvpList` devuelve solo su propia
 * fila.
 *
 * Hasta que corra la 065 la tabla no existe: las lecturas devuelven "sin
 * datos" (`missing: true`) y la pantalla no ofrece el botón, en vez de
 * mostrar un "Voy" que fallaría al tocarlo.
 */

const SCHEMA_MISSING = new Set(["42P01", "PGRST205", "42703"]);

export type MyRsvp =
  | { missing: true }
  | { missing: false; going: boolean; locationId: string | null };

export async function getMyRsvp(
  supabase: SupabaseClient,
  feastId: string,
  userId: string
): Promise<MyRsvp> {
  const { data, error } = await supabase
    .from("feast_rsvps")
    .select("location_id")
    .eq("feast_id", feastId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (!SCHEMA_MISSING.has(error.code ?? "")) {
      console.error(`[feast-rsvps] mine: ${error.code} ${error.message}`);
    }
    return { missing: true };
  }
  return {
    missing: false,
    going: !!data,
    locationId: (data?.location_id as string | null) ?? null,
  };
}

export type FeastRsvpList = {
  missing: boolean;
  total: number;
  /** Por lugar, en el orden de los lugares; `null` = sin lugar elegido. */
  byLocation: Array<{
    locationId: string | null;
    people: Array<{ name: string; at: string }>;
  }>;
};

/** La lista para la Asamblea, agrupada por lugar. */
export async function getFeastRsvpList(
  supabase: SupabaseClient,
  feastId: string,
  locationOrder: string[]
): Promise<FeastRsvpList> {
  const { data, error } = await supabase
    .from("feast_rsvps")
    .select("user_id, location_id, created_at")
    .eq("feast_id", feastId)
    .order("created_at", { ascending: true });
  if (error) {
    if (!SCHEMA_MISSING.has(error.code ?? "")) {
      console.error(`[feast-rsvps] list: ${error.code} ${error.message}`);
    }
    return { missing: true, total: 0, byLocation: [] };
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    location_id: string | null;
    created_at: string;
  }>;

  // Dos consultas y no un embed: user_id apunta a auth.users, no a profiles
  // (el mismo error que tenía la lista de voluntarios de Servicio).
  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const nameById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.full_name as string | null)?.trim() || (p.email as string | null) || "Sin nombre",
    ])
  );

  const groups = new Map<string | null, Array<{ name: string; at: string }>>();
  for (const r of rows) {
    // Un lugar que ya no está en la Fiesta cuenta como "sin lugar".
    const key = r.location_id && locationOrder.includes(r.location_id) ? r.location_id : null;
    const arr = groups.get(key) ?? [];
    arr.push({ name: nameById.get(r.user_id) ?? "Sin nombre", at: r.created_at });
    groups.set(key, arr);
  }

  const byLocation = [...locationOrder, null]
    .filter((k) => groups.has(k))
    .map((k) => ({
      locationId: k,
      people: (groups.get(k) ?? []).sort((a, b) => a.name.localeCompare(b.name, "es")),
    }));

  return { missing: false, total: rows.length, byLocation };
}
