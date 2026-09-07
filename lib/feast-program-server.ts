import { requireBahai } from "./auth";
import {
  getFeast,
  getFeastLocations,
  getFeastNews,
  getFeastPrayers,
} from "./data";
import { buildFeastProgram, type FeastProgram, type TreasuryReportRef } from "./feast-program";
import { createSupabaseServer } from "./supabase/server";

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

  // Informes publicados para la comunidad. La RLS (044) ya acota a la
  // localidad y a audience='comunidad'; el filtro explícito es para que
  // el tesorero —que también lee sus borradores e internos— no los vea
  // ofrecidos acá.
  const supabase = createSupabaseServer();
  const { data: reports } = await supabase
    .from("treasury_reports")
    .select("title, subtitle, period_to, share_token")
    .eq("status", "published")
    .eq("audience", "comunidad")
    .order("period_to", { ascending: false })
    .limit(12);

  const program = buildFeastProgram({
    feast,
    localityName: session.locality.name,
    locations,
    prayers,
    news,
    reports: (reports ?? []) as TreasuryReportRef[],
  });

  return { kind: "ok", program, isAdmin };
}
