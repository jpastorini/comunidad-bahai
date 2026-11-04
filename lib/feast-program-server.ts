import { requireBahai } from "./auth";
import {
  getFeast,
  getFeastLocations,
  getFeastNews,
  getFeastPrayers,
} from "./data";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFeastProgram,
  feastTreasury,
  type FeastProgram,
  type FeastProgramTreasury,
  type TreasuryReportRef,
} from "./feast-program";
import { createSupabaseServer } from "./supabase/server";
import { sanitizeReportSnapshot } from "./treasury-report-content";
import { getPublicationForFeast } from "./treasury-publications";
import type { Feast } from "./types";

/**
 * La Tesorería de una Fiesta, para la pantalla (/fiestas/[id]), el deck y
 * el folleto: los informes emitidos para la comunidad más la foto de
 * Publicar, y `feastTreasury()` elige.
 */
export async function loadFeastTreasury(
  supabase: SupabaseClient,
  localityId: string,
  feast: Feast
): Promise<FeastProgramTreasury | null> {
  // La RLS (044) ya acota a la localidad y a lo que la persona puede leer;
  // los filtros explícitos son para que el tesorero —que también lee sus
  // borradores e internos, y el admin nacional, que lee todo— no los vea
  // ofrecidos acá.
  const [{ data: reports, error }, publication] = await Promise.all([
    supabase
      .from("treasury_reports")
      .select("title, subtitle, period_to, share_token, snapshot")
      .eq("locality_id", localityId)
      .eq("status", "published")
      .eq("audience", "comunidad")
      .order("period_to", { ascending: false })
      .limit(12),
    getPublicationForFeast(supabase, localityId, feast),
  ]);
  if (error) console.error("[loadFeastTreasury]", error.message);
  const refs: TreasuryReportRef[] = ((reports ?? []) as Record<string, unknown>[]).map(
    (r) => ({
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      period_to: r.period_to as string,
      share_token: r.share_token as string,
      snapshot: sanitizeReportSnapshot(r.snapshot),
    })
  );
  return feastTreasury({ feast, reports: refs, publication });
}

export type FeastProgramLoad =
  | { kind: "ok"; program: FeastProgram; isAdmin: boolean }
  | { kind: "not-found" }
  /** La Fiesta existe pero todavía no inició: el programa no es público. */
  | { kind: "not-started" };

/**
 * Carga el programa de una Fiesta para el deck (/programa/[id]) y para el
 * folleto PDF (/programa/[id]/pdf). Un solo camino para las dos salidas.
 *
 * Quién lo ve: la RLS de feasts decide si la fila existe para esta
 * persona (borradores solo para la Asamblea, nada para un Amigo de la
 * Fe). Encima de eso, el programa de una Fiesta publicada pero NO
 * iniciada sigue siendo interno —igual que en /fiestas/[id]—, salvo para
 * la Asamblea, que lo necesita ver antes para ensayar y proyectar.
 */
export async function loadFeastProgram(id: string): Promise<FeastProgramLoad> {
  const session = await requireBahai();

  const [feast, locations, prayers, news] = await Promise.all([
    getFeast(id),
    getFeastLocations(id),
    getFeastPrayers(id),
    getFeastNews(id),
  ]);
  if (!feast) return { kind: "not-found" };

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && feast.status !== "in_progress") return { kind: "not-started" };

  const treasury = await loadFeastTreasury(
    createSupabaseServer(),
    session.locality.id,
    feast
  );

  const program = buildFeastProgram({
    treasury,
    feast,
    localityName: session.locality.name,
    locations,
    prayers,
    news,
  });

  return { kind: "ok", program, isAdmin };
}
