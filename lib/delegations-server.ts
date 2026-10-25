import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "./supabase/admin";
import { isPermission, type Permission } from "./delegations";

/** El día civil de Montevideo, "yyyy-mm-dd": el mismo corte que `has_perm()`. */
export function todayMontevideo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(
    new Date()
  );
}

function isVigente(until: string | null, today = todayMontevideo()): boolean {
  return !until || until >= today;
}

export type HelperAssignment = {
  perms: Permission[];
  /** Vigentes hoy (un nombramiento vencido sigue en la tabla, apagado). */
  active: Permission[];
  until: string | null;
};

function isSchemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205" || code === "42703";
}

/**
 * Los ayudantes de una comunidad (088), por persona. Lo lee la Asamblea
 * con su RLS. `missing` si la migración todavía no corrió.
 */
export async function getLocalityHelpers(
  supabase: SupabaseClient,
  localityId: string
): Promise<{ byProfile: Map<string, HelperAssignment>; missing: boolean }> {
  const byProfile = new Map<string, HelperAssignment>();
  const { data, error } = await supabase
    .from("delegations")
    .select("profile_id, permission, until")
    .eq("locality_id", localityId);
  if (error) {
    if (!isSchemaMissing(error.code)) console.error("[delegations] lectura:", error);
    return { byProfile, missing: isSchemaMissing(error.code) };
  }
  const today = todayMontevideo();
  for (const row of (data ?? []) as Array<{
    profile_id: string;
    permission: string;
    until: string | null;
  }>) {
    if (!isPermission(row.permission)) continue;
    const entry = byProfile.get(row.profile_id) ?? { perms: [], active: [], until: null };
    entry.perms.push(row.permission);
    if (isVigente(row.until, today)) entry.active.push(row.permission);
    // Se nombra con un solo "hasta" para todo: el más lejano manda.
    if (row.until && (!entry.until || row.until > entry.until)) entry.until = row.until;
    byProfile.set(row.profile_id, entry);
  }
  return { byProfile, missing: false };
}

/**
 * Quiénes tienen este permiso vigente en la comunidad, para los avisos
 * (chat de Secretaría, contactos). Con service-role: lo llama el servidor
 * en nombre de un creyente que no lee los nombramientos.
 */
export async function getDelegateIds(
  localityId: string,
  perm: Permission
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("delegations")
    .select("profile_id, until, profiles!delegations_profile_id_fkey(is_bahai, disabled_at)")
    .eq("locality_id", localityId)
    .eq("permission", perm);
  if (error) {
    if (!isSchemaMissing(error.code)) console.error("[delegations] avisos:", error);
    return [];
  }
  const today = todayMontevideo();
  return ((data ?? []) as unknown as Array<{
    profile_id: string;
    until: string | null;
    profiles: { is_bahai: boolean; disabled_at: string | null } | null;
  }>)
    .filter((r) => isVigente(r.until, today) && r.profiles?.is_bahai && !r.profiles.disabled_at)
    .map((r) => r.profile_id);
}
