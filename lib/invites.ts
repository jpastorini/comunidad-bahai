import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";

// ─── Link de invitación por localidad ────────────────────────────
// Un token reusable por localidad (/invitacion/<token>) que incorpora
// automáticamente a quien lo abre en su primer ingreso. Ver migración
// 037_locality_invites.sql para el razonamiento de seguridad.

/** Cookie que transporta el token entre la invitación y el callback de auth. */
export const INVITE_COOKIE = "cb_invite";

const TOKEN_RE = /^[0-9a-f]{64}$/;

export type ResolvedInvite = {
  localityId: string;
  localityName: string;
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
    .select("locality_id")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return null;

  const { data: locality } = await supabase
    .from("localities")
    .select("id, name, is_active")
    .eq("id", (invite as { locality_id: string }).locality_id)
    .maybeSingle();
  if (!locality || !(locality as { is_active: boolean }).is_active) return null;

  return {
    localityId: (locality as { id: string }).id,
    localityName: (locality as { name: string }).name,
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
 * El update usa el cliente del usuario (policy profiles_update_self).
 */
export async function applyInviteToken(
  userId: string,
  token: string
): Promise<ApplyInviteResult> {
  const invite = await resolveInviteToken(token);
  if (!invite) return "invalid";

  const supabase = createSupabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locality_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return "invalid";

  if (profile.locality_id === invite.localityId) return "already-member";
  if (profile.locality_id) return "other-locality";

  const { error } = await supabase
    .from("profiles")
    .update({ locality_id: invite.localityId })
    .eq("id", userId);
  return error ? "invalid" : "applied";
}

/**
 * Token de invitación de una localidad para el panel (lo lee el admin
 * local con su propio cliente; la RLS lo limita a su localidad). Si la
 * localidad todavía no tiene invitación (creada antes de la migración
 * 037 no, pero una localidad nueva sí), la crea acá.
 */
export async function getOrCreateLocalityInvite(
  localityId: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase
    .from("locality_invites")
    .select("token")
    .eq("locality_id", localityId)
    .maybeSingle();
  if (existing) return (existing as { token: string }).token;

  const { data: created, error } = await supabase
    .from("locality_invites")
    .insert({ locality_id: localityId })
    .select("token")
    .single();
  if (error) {
    console.error("[getOrCreateLocalityInvite] error:", error);
    return null;
  }
  return (created as { token: string }).token;
}
