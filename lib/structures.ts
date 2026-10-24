import "server-only";

import { getLocalityMembers, type LocalityMember } from "./memberships";
import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer } from "./supabase/server";
import {
  isNationalLocality,
  STRUCTURE_TYPE_LABELS,
  type Locality,
  type StructureType,
} from "./types";

/**
 * Estructuras (082): los Comités, Departamentos y la Coordinación o Junta
 * de Instituto que crea una Asamblea. Cada una es una fila de
 * `localities` con `kind = 'estructura'` y `parent_id` en la Asamblea.
 *
 * Los integrantes se leen y se escriben con service-role: la RLS de
 * `profile_localities` (055) solo deja tocar filas de la localidad PUESTA,
 * y la Asamblea que nombra a los integrantes nunca tiene puesta a su
 * estructura. Por eso el permiso lo chequea el action, antes.
 */

export type StructureWithMembers = {
  locality: Locality;
  members: LocalityMember[];
};

/** Códigos que dicen "falta la 082": columna, check de `kind`, caché de PostgREST. */
export function isStructuresSchemaMissing(code: string | null | undefined): boolean {
  return code === "42703" || code === "23514" || code === "PGRST204";
}

/** "Comité", o "Comité · Nacional" cuando lo creó la Asamblea Nacional. */
export function structureTypeLabel(
  type: StructureType | null | undefined,
  parent?: Pick<Locality, "kind"> | null
): string {
  const base = type ? STRUCTURE_TYPE_LABELS[type] : "Estructura";
  return parent && isNationalLocality(parent) ? `${base} · Nacional` : base;
}

/** Las estructuras que creó una Asamblea, con sus integrantes. */
export async function getChildStructures(
  parentId: string
): Promise<{ structures: StructureWithMembers[]; schemaMissing: boolean }> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("localities")
    .select("*")
    .eq("parent_id", parentId)
    .order("name");
  if (error) {
    if (isStructuresSchemaMissing(error.code)) return { structures: [], schemaMissing: true };
    console.error("[structures] listar:", error.message);
    return { structures: [], schemaMissing: false };
  }

  const admin = createSupabaseAdmin();
  const localities = (data ?? []) as Locality[];
  const structures = await Promise.all(
    localities.map(async (locality) => ({
      locality,
      members: admin ? await getLocalityMembers(admin, locality.id) : [],
    }))
  );
  return { structures, schemaMissing: false };
}

export type StructureCandidate = { id: string; name: string };

/**
 * A quién puede nombrar una Asamblea en sus estructuras: creyentes
 * (un Amigo/a de la Fe no puede tener cargos, 047) y habilitados. Una
 * Asamblea Local, a los de su comunidad; la Nacional, a cualquiera del
 * país, porque sus comités los integran personas de todas partes.
 */
export async function getStructureCandidates(parent: Locality): Promise<StructureCandidate[]> {
  const admin = createSupabaseAdmin();
  if (!admin) return [];

  if (isNationalLocality(parent)) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_bahai", true)
      .is("disabled_at", null)
      .order("full_name", { ascending: true })
      .limit(3000);
    if (error) {
      console.error("[structures] candidatos nacionales:", error.message);
      return [];
    }
    return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
      (p) => ({ id: p.id, name: p.full_name?.trim() || p.email || "Sin nombre" })
    );
  }

  const roster = await getLocalityMembers(admin, parent.id);
  return roster
    .filter((m) => m.is_bahai && !m.disabled_at)
    .map((m) => ({ id: m.id, name: m.full_name?.trim() || m.email || "Sin nombre" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** La misma regla que `getStructureCandidates`, para una sola persona. */
export async function isStructureCandidate(parent: Locality, profileId: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  if (!admin) return false;
  const { data: profile } = await admin
    .from("profiles")
    .select("is_bahai, disabled_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile || !profile.is_bahai || profile.disabled_at) return false;
  if (isNationalLocality(parent)) return true;
  const { data: membership } = await admin
    .from("profile_localities")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("locality_id", parent.id)
    .maybeSingle();
  return !!membership;
}
