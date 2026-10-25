import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "./supabase/admin";

/**
 * El mapa del país (086): 3 zonas electorales y 20 agrupaciones (los
 * departamentos, con Canelones partido en Este y Oeste). Es territorio,
 * no institución: no tiene panel ni integrantes. Lo usan el padrón de la
 * Asamblea Nacional, las estructuras de agrupación y, más adelante, la
 * Convención.
 */

export type ElectoralZone = { id: string; name: string; sort_order: number };
export type Agrupacion = {
  id: string;
  name: string;
  zone_id: string | null;
  sort_order: number;
};
export type Territory = {
  zones: ElectoralZone[];
  agrupaciones: Agrupacion[];
  /** Falta la 086: las pantallas no ofrecen nada. */
  missing: boolean;
};

export async function getTerritory(supabase: SupabaseClient): Promise<Territory> {
  const [zones, agrupaciones] = await Promise.all([
    supabase.from("electoral_zones").select("id, name, sort_order").order("sort_order"),
    supabase.from("agrupaciones").select("id, name, zone_id, sort_order").order("sort_order"),
  ]);
  if (zones.error || agrupaciones.error) {
    return { zones: [], agrupaciones: [], missing: true };
  }
  return {
    zones: (zones.data ?? []) as ElectoralZone[],
    agrupaciones: (agrupaciones.data ?? []) as Agrupacion[],
    missing: false,
  };
}

export type PeopleAgrupaciones = {
  /** La que cuenta: la de su Asamblea Local, o la elegida. */
  effective: Map<string, string>;
  /** La que eligió la persona (o le cargó la Asamblea Nacional). */
  own: Map<string, string>;
};

/**
 * La agrupación EFECTIVA de cada persona: la de su Asamblea Local si
 * tiene una, si no la que eligió. Misma regla que `person_agrupacion()`
 * en la base, en una pasada para un padrón entero. Con service-role,
 * porque la RLS de `profile_localities` no le muestra a la Asamblea
 * Nacional las membresías de otras comunidades.
 */
export async function getEffectiveAgrupaciones(
  profileIds: string[]
): Promise<PeopleAgrupaciones> {
  const out = new Map<string, string>();
  const own = new Map<string, string>();
  const result = { effective: out, own };
  const admin = createSupabaseAdmin();
  if (!admin || profileIds.length === 0) return result;

  for (let i = 0; i < profileIds.length; i += 500) {
    const ids = profileIds.slice(i, i + 500);
    const [mine, ael] = await Promise.all([
      admin.from("profiles").select("id, agrupacion_id").in("id", ids),
      admin
        .from("profile_localities")
        .select("profile_id, created_at, localities!inner(kind, agrupacion_id)")
        .in("profile_id", ids)
        .eq("localities.kind", "ael")
        .order("created_at"),
    ]);
    if (mine.error || ael.error) return result; // sin la 086
    for (const p of (mine.data ?? []) as Array<{ id: string; agrupacion_id: string | null }>) {
      if (p.agrupacion_id) {
        out.set(p.id, p.agrupacion_id);
        own.set(p.id, p.agrupacion_id);
      }
    }
    // La Asamblea manda sobre lo elegido; la más vieja, si hay dos.
    const fromAel = new Map<string, string>();
    for (const m of (ael.data ?? []) as unknown as Array<{
      profile_id: string;
      localities: { agrupacion_id: string | null } | null;
    }>) {
      const a = m.localities?.agrupacion_id;
      if (a && !fromAel.has(m.profile_id)) fromAel.set(m.profile_id, a);
    }
    fromAel.forEach((a, id) => out.set(id, a));
  }
  return result;
}
