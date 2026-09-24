import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceUrgency } from "./types";

/**
 * Necesidades de servicio de la localidad, vistas por un creyente.
 *
 * Quién se ofreció es de la persona y de la Asamblea (RLS de la 064); la
 * comunidad ve solo cuántos, por `service_volunteer_counts()`. Hasta que
 * corra la 064 la función no existe: el conteo queda en null y la pantalla
 * no lo muestra, pero ofrecerse funciona igual (la policy de insert ya
 * estaba en el schema inicial).
 */

export type ServiceBoardItem = {
  id: string;
  title: string;
  description: string;
  urgency: ServiceUrgency;
  /** Cuántos se ofrecieron; null si no se pudo saber. */
  volunteers: number | null;
  /** true si quien mira ya se ofreció. */
  mine: boolean;
};

export async function getServiceBoard(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceBoardItem[]> {
  const [needsRes, mineRes, countsRes] = await Promise.all([
    supabase
      .from("service_needs")
      .select("id, title, description, urgency")
      .order("created_at", { ascending: false }),
    supabase.from("service_volunteers").select("need_id").eq("user_id", userId),
    supabase.rpc("service_volunteer_counts"),
  ]);

  if (needsRes.error) {
    console.error(`[service] needs: ${needsRes.error.code ?? ""} ${needsRes.error.message}`);
    return [];
  }
  if (mineRes.error) {
    console.error(`[service] mine: ${mineRes.error.code ?? ""} ${mineRes.error.message}`);
  }
  if (countsRes.error) {
    console.warn(`[service] counts (¿falta la 064?): ${countsRes.error.code ?? ""} ${countsRes.error.message}`);
  }

  const mine = new Set(
    ((mineRes.data ?? []) as Array<{ need_id: string }>).map((r) => r.need_id)
  );
  const counts = countsRes.error
    ? null
    : new Map(
        ((countsRes.data ?? []) as Array<{ need_id: string; volunteers: number }>).map(
          (r) => [r.need_id, r.volunteers]
        )
      );

  return (
    (needsRes.data ?? []) as Array<{
      id: string;
      title: string;
      description: string;
      urgency: ServiceUrgency;
    }>
  ).map((n) => ({
    ...n,
    volunteers: counts ? counts.get(n.id) ?? 0 : null,
    mine: mine.has(n.id),
  }));
}
