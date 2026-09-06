import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";

// ─── Link de invitación por localidad ────────────────────────────
// Un token reusable por localidad (/invitacion/<token>) que incorpora
// automáticamente a quien lo abre en su primer ingreso. Ver migración
// 037_locality_invites.sql para el razonamiento de seguridad.
//
// Desde la 047 hay DOS tokens por localidad, en la misma fila:
//   - `token`: el de siempre, incorpora como creyente.
//   - `friends_token`: para Amigos de la Fe, incorpora con is_bahai=false
//     (sin Tesorería ni Fiesta de los 19 Días).

/** Cookie que transporta el token entre la invitación y el callback de auth. */
export const INVITE_COOKIE = "cb_invite";

const TOKEN_RE = /^[0-9a-f]{64}$/;

/** A quién incorpora un link: creyentes o Amigos de la Fe. */
export type InviteAudience = "creyentes" | "amigos";

export type ResolvedInvite = {
  localityId: string;
  localityName: string;
  audience: InviteAudience;
};

export type LocalityInviteTokens = {
  /** Link para creyentes. */
  token: string;
  /** Link para Amigos de la Fe (047). */
  friendsToken: string;
};

/**
 * Resuelve un token a su localidad, para las páginas públicas de
 * invitación (visitante aún sin sesión). Usa la service-role key: la
 * RLS de locality_invites solo deja leer a los admins de la localidad.
 */
export async function resolveInviteToken(
  token: string
): Promise<ResolvedInvite | null> {
  if (!TOKEN_RE.test(token)) return null;
  const supabase = createSupabaseAdmin();
  if (!supabase) return null;

  const { data: invite } = await supabase
    .from("locality_invites")
    .select("locality_id, token, friends_token")
    .or(`token.eq.${token},friends_token.eq.${token}`)
    .maybeSingle();
  if (!invite) return null;
  const row = invite as {
    locality_id: string;
    token: string;
    friends_token: string;
  };

  const { data: locality } = await supabase
    .from("localities")
    .select("id, name, is_active")
    .eq("id", row.locality_id)
    .maybeSingle();
  if (!locality || !(locality as { is_active: boolean }).is_active) return null;

  return {
    localityId: (locality as { id: string }).id,
    localityName: (locality as { name: string }).name,
    audience: row.friends_token === token ? "amigos" : "creyentes",
  };
}

export type ApplyInviteResult =
  | "applied"          // primer ingreso: quedó incorporado a la localidad
  | "already-member"   // ya pertenecía a esa misma localidad
  | "other-locality"   // pertenece a OTRA: no lo movemos automáticamente
  | "invalid";         // token inexistente / localidad inactiva

/**
 * Incorpora al usuario a la localidad del token. Solo aplica cuando el
 * perfil NO tiene localidad (primer ingreso): mudarse de comunidad sigue
 * pasando por el flujo de solicitud + aprobación de la Asamblea destino.
 *
 * El update va con la service-role key: `is_bahai` está congelado para
 * el propio usuario (policy profiles_update_self, 047), así que el link
 * para amigos no podría escribirlo con el cliente del usuario. La regla
 * de "solo si todavía no tiene localidad" se chequea acá, a mano, y es la
 * misma que antes aplicaba la policy.
 */
export async function applyInviteToken(
  userId: string,
  token: string
): Promise<ApplyInviteResult> {
  const invite = await resolveInviteToken(token);
  if (!invite) return "invalid";

  const admin = createSupabaseAdmin();
  if (!admin) return "invalid";
  const { data: profile } = await admin
    .from("profiles")
    .select("locality_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return "invalid";

  if (profile.locality_id === invite.localityId) return "already-member";
  if (profile.locality_id) return "other-locality";

  const { error } = await admin
    .from("profiles")
    .update({
      locality_id: invite.localityId,
      is_bahai: invite.audience === "creyentes",
    })
    .eq("id", userId)
    .is("locality_id", null); // carrera: que nadie lo haya incorporado entre medio
  return error ? "invalid" : "applied";
}

/**
 * Tokens de invitación de una localidad para el panel (los lee el admin
 * local con su propio cliente; la RLS lo limita a su localidad). Si la
 * localidad todavía no tiene invitación (una localidad nueva), la crea
 * acá; los dos tokens salen por default de la base.
 */
export async function getOrCreateLocalityInvite(
  localityId: string
): Promise<LocalityInviteTokens | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase
    .from("locality_invites")
    .select("token, friends_token")
    .eq("locality_id", localityId)
    .maybeSingle();
  if (existing) return toTokens(existing);

  const { data: created, error } = await supabase
    .from("locality_invites")
    .insert({ locality_id: localityId })
    .select("token, friends_token")
    .single();
  if (error) {
    console.error("[getOrCreateLocalityInvite] error:", error);
    return null;
  }
  return toTokens(created);
}

function toTokens(row: unknown): LocalityInviteTokens {
  const r = row as { token: string; friends_token: string };
  return { token: r.token, friendsToken: r.friends_token };
}
