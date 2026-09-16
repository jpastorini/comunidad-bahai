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
