import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";

/**
 * Una comunidad a la que la persona pertenece (migración 055).
 *
 * La pertenencia vive en `profile_localities`, con el rol y los tags DE
 * ESA COMUNIDAD adentro. `profiles` guarda solo la que tiene puesta —el
 * sombrero—, que es la que ve la RLS a través de `current_locality_id()`.
 */
export type Membership = {
  localityId: string;
  name: string;
  city: string | null;
  role: "member" | "admin";
  /** Es la comunidad que la persona tiene puesta ahora. */
  isActive: boolean;
};

type Row = {
  locality_id: string;
  role: "member" | "admin";
  localities: { name: string; city: string | null } | null;
};

/**
 * Las comunidades de la persona, la activa primero.
 *
 * ⚠️ Si la 055 todavía no corrió, devuelve una lista vacía y lo loguea:
 * el perfil tiene que seguir abriendo. Con la lista vacía (o con una
 * sola comunidad) la pantalla no muestra ningún selector, que es
 * exactamente lo que ve hoy todo el mundo.
 */
export const getMyMemberships = cache(
  async (
    userId: string,
    activeLocalityId: string | null
  ): Promise<Membership[]> => {
    if (!isSupabaseConfigured()) return [];
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("profile_localities")
      .select("locality_id, role, localities(name, city)")
      .eq("profile_id", userId);

    if (error) {
      console.warn("[memberships] no se pudieron leer:", error.message);
      return [];
    }

    return ((data ?? []) as unknown as Row[])
      .map((r) => ({
        localityId: r.locality_id,
        name: r.localities?.name ?? "Comunidad",
        city: r.localities?.city ?? null,
        role: r.role,
        isActive: r.locality_id === activeLocalityId,
      }))
      .sort((a, b) =>
        a.isActive === b.isActive
          ? a.name.localeCompare(b.name, "es")
          : a.isActive
            ? -1
            : 1
      );
  }
);

// ─── El padrón de una comunidad (056) ──────────────────────────────

/**
 * Una persona en el padrón de una comunidad, con el rol y los tags DE
 * ESA COMUNIDAD —no los del sombrero que tenga puesto—.
 */
export type LocalityMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_bahai: boolean;
  disabled_at: string | null;
  last_seen_at: string | null;
  pwa_installed_at: string | null;
  created_at: string;
  role: "member" | "admin";
  can_respond_chat: boolean;
  can_manage_treasury: boolean;
  can_manage_bulletin: boolean;
};

/**
 * Quiénes pertenecen a una comunidad.
 *
 * ⚠️ Esta es LA consulta que reemplaza a `profiles.locality_id` en todo
 * lo que sea un padrón. La distinción, que no es obvia:
 *
 *   · "¿qué puede ver quien está preguntando?" → el sombrero puesto,
 *     o sea `current_locality_id()` y las 152 policies. No cambia.
 *   · "¿quién es de esta comunidad?" → la membresía, o sea esto.
 *
 * Con una sola membresía por persona las dos dan lo mismo y la
 * diferencia no se nota. Con dos sombreros, preguntar por el sombrero
 * hace desaparecer a la persona del padrón de la otra comunidad: se cae
 * de la lista de creyentes, del denominador del informe de lectura y
 * —lo peor, porque es mudo— de los destinatarios del push.
 *
 * Sirve para los dos clientes: con cookies la RLS de
 * `profile_localities` la acota a la Asamblea de esa localidad; con
 * service-role (el push) devuelve todo.
 *
 * ⚠️ Si la 056 no corrió todavía, cae al padrón viejo (el sombrero) y
 * loguea. Da lo mismo mientras nadie tenga dos membresías, y es
 * preferible a que el push se quede sin destinatarios.
 */
export async function getLocalityMembers(
  supabase: SupabaseClient,
  localityId: string
): Promise<LocalityMember[]> {
  const { data, error } = await supabase.rpc("locality_members", {
    p_locality_id: localityId,
  });

  if (!error) return (data ?? []) as LocalityMember[];

  console.warn(
    `[memberships] locality_members falló (${error.code ?? "?"}: ${error.message}); uso el padrón viejo`
  );

  const { data: rows, error: fallbackError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, is_bahai, disabled_at, last_seen_at, pwa_installed_at, created_at, role, can_respond_chat, can_manage_treasury, can_manage_bulletin"
    )
    .eq("locality_id", localityId)
    .order("full_name", { ascending: true });

  if (fallbackError) {
    console.error("[memberships] padrón viejo también falló:", fallbackError.message);
    return [];
  }
  return (rows ?? []) as LocalityMember[];
}

/** Solo las personas activas (sin deshabilitar). */
export function activeMembers(members: LocalityMember[]): LocalityMember[] {
  return members.filter((m) => !m.disabled_at);
}
