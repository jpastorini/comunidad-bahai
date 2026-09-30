"use server";

import { revalidatePath } from "next/cache";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * El padrón de contribuyentes (075): vincular, desvincular, renombrar,
 * fusionar, desactivar. Detrás del tag de Tesorería, como el libro.
 *
 * Fusionar pasa por la RPC `merge_contributors`, que es la única que puede
 * mover asientos de meses cerrados (solo el `contributor_id`, ver la 075).
 */

type Result = { ok: boolean; error: string | null; message?: string };
const fail = (error: string): Result => ({ ok: false, error });
const done = (message: string): Result => {
  revalidatePath("/admin/tesoreria/contribuyentes");
  revalidatePath("/admin/tesoreria/libro");
  revalidatePath("/admin/tesoreria/compromisos");
  return { ok: true, error: null, message };
};

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

function friendly(message: string): string {
  const m = /^[A-Z_]+: (.*)$/.exec(message);
  if (m) return m[1];
  if (message.includes("treasury_contributors_name_uniq")) {
    return "Ya hay un contribuyente con ese nombre. Si es la misma persona, fusionalos.";
  }
  return message;
}

export async function linkContributorAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const id = str(formData, "contributor_id");
  const profileId = str(formData, "profile_id") || null;
  if (!id) return fail("Falta la ficha.");
  const { error } = await supabase
    .from("treasury_contributors")
    .update({ profile_id: profileId })
    .eq("id", id);
  if (error) return fail(friendly(error.message));
  return done(profileId ? "Vinculado. Sus aportes ya le aparecen en Mis aportes." : "Desvinculado.");
}

export async function renameContributorAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const id = str(formData, "contributor_id");
  const name = str(formData, "name").slice(0, 120);
  const kind = str(formData, "kind");
  if (!id) return fail("Falta la ficha.");
  if (!name) return fail("El nombre no puede quedar vacío.");
  const payload: Record<string, unknown> = { name };
  if (["persona", "familia", "negocio", "colecta", "otro"].includes(kind)) payload.kind = kind;
  const { error } = await supabase.from("treasury_contributors").update(payload).eq("id", id);
  if (error) return fail(friendly(error.message));
  return done("Ficha actualizada. El libro y los recibos nuevos usan este nombre.");
}

export async function setContributorActiveAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const id = str(formData, "contributor_id");
  const active = str(formData, "active") === "1";
  if (!id) return fail("Falta la ficha.");
  const { error } = await supabase
    .from("treasury_contributors")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return fail(friendly(error.message));
  return done(active ? "Ficha reactivada." : "Ficha desactivada: deja de ofrecerse en el buscador; su historial sigue en el libro.");
}

export async function deleteContributorAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const id = str(formData, "contributor_id");
  if (!id) return fail("Falta la ficha.");
  // Solo si nunca se usó: la FK del libro es la red de abajo.
  const { count } = await supabase
    .from("treasury_entries")
    .select("id", { count: "exact", head: true })
    .eq("contributor_id", id);
  if (count && count > 0) return fail("Esta ficha tiene aportes: fusionala o desactivala, no se puede eliminar.");
  // Un compromiso registrado por el tesorero cuelga de la ficha (077).
  const { count: commitments } = await supabase
    .from("treasury_commitments")
    .select("locality_id", { count: "exact", head: true })
    .eq("contributor_id", id);
  if (commitments && commitments > 0) {
    return fail("Esta ficha tiene un compromiso mensual: quitalo antes desde Tesorería → Compromisos.");
  }
  const { error } = await supabase.from("treasury_contributors").delete().eq("id", id);
  if (error) return fail(friendly(error.message));
  return done("Ficha eliminada.");
}

export async function mergeContributorsAction(formData: FormData): Promise<Result> {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const source = str(formData, "source_id");
  const target = str(formData, "target_id");
  if (!source || !target) return fail("Elegí con qué ficha fusionar.");
  if (source === target) return fail("Son la misma ficha.");
  const { data, error } = await supabase.rpc("merge_contributors", { p_source: source, p_target: target });
  if (error) {
    const code = (error as { code?: string }).code;
    return fail(
      code === "42883" || code === "PGRST202"
        ? "Falta aplicar la migración 075 en Supabase."
        : friendly(error.message)
    );
  }
  const moved = Number(data ?? 0);
  return done(
    `Fusionadas: ${moved} ${moved === 1 ? "aporte pasó" : "aportes pasaron"} a la ficha que queda. Los recibos ya emitidos no cambian.`
  );
}
