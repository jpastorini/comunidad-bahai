import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Del buscador de contribuyentes (ContributorPicker) a un contributor_id.
 * Vivía en las actions del Libro; salió acá porque el alta de un
 * compromiso desde Tesorería (077) usa el mismo buscador y tiene que
 * resolver igual: si divergen, el mismo creyente termina con dos fichas.
 * No va en un módulo "use server": exportada desde ahí sería una action
 * que cualquiera podría llamar.
 */

type ServerClient = SupabaseClient;

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string) || "").trim();
}

/**
 * Resuelve el contribuyente del movimiento. Tres caminos, según lo que
 * eligió el tesorero en el buscador (ver ContributorPicker):
 *
 *  · `contributor_id`         — uno que ya está en el libro. Si además
 *                               vino `link_profile_id`, se lo vincula al
 *                               creyente (es como se van emparejando los
 *                               importados de la planilla).
 *  · `contributor_profile_id` — un creyente de la app. Se usa su
 *                               contribuyente vinculado; si no tiene, se
 *                               crea (o se vincula uno suelto que ya
 *                               exista con su mismo nombre).
 *  · `contributor_name`       — un nombre nuevo: alguien de otra
 *                               comunidad, una empresa, un grupo.
 *
 * Devuelve null cuando el movimiento no tiene contribuyente (un gasto).
 */
export async function resolveContributor(
  supabase: ServerClient,
  formData: FormData
): Promise<string | null> {
  const id = str(formData, "contributor_id");
  if (id) {
    const linkProfileId = str(formData, "link_profile_id");
    if (linkProfileId) await linkContributor(supabase, id, linkProfileId);
    return id;
  }

  const profileId = str(formData, "contributor_profile_id");
  if (profileId) return resolveContributorForProfile(supabase, profileId);

  const name = str(formData, "contributor_name");
  if (!name) return null;
  return findOrCreateContributor(supabase, name, null);
}

async function linkContributor(
  supabase: ServerClient,
  contributorId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from("treasury_contributors")
    .update({ profile_id: profileId })
    .eq("id", contributorId);
  if (error) {
    throw new Error(`No se pudo vincular el contribuyente: ${error.message}`);
  }
}

/** El contribuyente "persona" de un creyente; se crea si no existe. */
async function resolveContributorForProfile(
  supabase: ServerClient,
  profileId: string
): Promise<string> {
  const { data: linked } = await supabase
    .from("treasury_contributors")
    .select("id, kind")
    .eq("profile_id", profileId)
    .order("created_at");
  const rows = (linked ?? []) as Array<{ id: string; kind: string }>;
  // Una persona puede tener varios contribuyentes vinculados (a título
  // personal, por su negocio); para un aporte propio manda el personal.
  const personal = rows.find((r) => r.kind === "persona") ?? rows[0];
  if (personal) return personal.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", profileId)
    .maybeSingle();
  const p = profile as { full_name: string | null; email: string | null } | null;
  const name = p?.full_name?.trim() || p?.email?.trim();
  if (!name) throw new Error("Ese creyente no tiene nombre cargado.");

  return findOrCreateContributor(supabase, name, profileId);
}

/**
 * Busca por nombre (el índice único es sobre lower(btrim(name)), así que
 * la comparación va sin distinguir mayúsculas) y si no está lo crea.
 * Si el nombre ya existe suelto y venimos con un perfil, se lo vincula:
 * es el caso de los importados de la planilla.
 */
async function findOrCreateContributor(
  supabase: ServerClient,
  name: string,
  profileId: string | null
): Promise<string> {
  const { data: existing } = await supabase
    .from("treasury_contributors")
    .select("id, profile_id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; profile_id: string | null };
    if (profileId && !row.profile_id) {
      await linkContributor(supabase, row.id, profileId);
    } else if (profileId && row.profile_id !== profileId) {
      throw new Error(
        `Ya hay un contribuyente "${name}" vinculado a otro creyente.`
      );
    }
    return row.id;
  }

  const { data: created, error } = await supabase
    .from("treasury_contributors")
    .insert({ name, kind: "persona", profile_id: profileId })
    .select("id")
    .single();
  if (error) {
    throw new Error(`No se pudo crear el contribuyente: ${error.message}`);
  }
  return (created as { id: string }).id;
}
