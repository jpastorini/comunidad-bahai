import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "./supabase/admin";
import type { ChatTopic } from "./types";

/**
 * Iniciar una conversación desde la Asamblea (sin esperar a que la
 * persona escriba primero).
 *
 * Cuando la persona escribe, ya tiene la app abierta. Cuando la Asamblea
 * inicia, la única forma de que se entere es el push: quien no tiene
 * avisos no se entera hasta volver a abrir la app, que puede ser en
 * semanas. Por eso la conversación dice ANTES de escribir si el mensaje
 * le va a llegar, con el mismo criterio del informe de lectura: la app
 * no finge haber avisado.
 */

export type ContactReach = {
  /** Tiene al menos una suscripción de push activa. */
  hasPush: boolean;
  lastSeenAt: string | null;
};

/** Service-role: la RLS de `push_subscriptions` solo deja ver las propias.
 *  Null si no se pudo saber (sin service-role key o error). */
export async function getContactReach(memberId: string): Promise<ContactReach | null> {
  const admin = createSupabaseAdmin();
  if (!admin) return null;
  const [{ data: subs, error: subsError }, { data: profile, error: profileError }] =
    await Promise.all([
      admin.from("push_subscriptions").select("id").eq("user_id", memberId).limit(1),
      admin.from("profiles").select("last_seen_at").eq("id", memberId).maybeSingle(),
    ]);
  if (subsError || profileError) {
    console.error(
      "[chat-contact] reach:",
      subsError?.message ?? profileError?.message
    );
    return null;
  }
  return {
    hasPush: (subs ?? []).length > 0,
    lastSeenAt: (profile as { last_seen_at: string | null } | null)?.last_seen_at ?? null,
  };
}

/**
 * Por qué NO se puede iniciar esta conversación, o null si se puede.
 *
 * Responder a quien ya escribió siempre vale (puede haberse mudado
 * después y la conversación sigue siendo de acá). Iniciar, en cambio,
 * solo con alguien que pertenece a esta comunidad —por MEMBRESÍA (056),
 * no por el sombrero que tenga puesto—: la RLS de insert no mira a quién
 * se le escribe, así que sin este chequeo se podría abrir una
 * conversación de Secretaría con cualquier persona del país.
 *
 * Y la Tesorería no es para un Amigo/a de la Fe (047): del lado de la
 * persona ese canal no existe, así que el mensaje no lo leería nunca.
 */
export async function contactBlockedReason(
  supabase: SupabaseClient,
  memberId: string,
  localityId: string,
  topic: ChatTopic,
  /** Ya hay mensajes en este canal con esta persona (en esta localidad). */
  hasConversation: boolean
): Promise<string | null> {
  const { data: target } = await supabase
    .from("profiles")
    .select("is_bahai")
    .eq("id", memberId)
    .maybeSingle();
  if (topic === "tesoreria" && target && target.is_bahai === false) {
    return "Los Amigos de la Fe no tienen el chat de Tesorería: escribile desde Secretaría.";
  }

  if (hasConversation) return null;

  const admin = createSupabaseAdmin();
  if (!admin) return null; // sin service-role no se puede verificar; la RLS sigue abajo
  const { data: membership, error } = await admin
    .from("profile_localities")
    .select("profile_id")
    .eq("profile_id", memberId)
    .eq("locality_id", localityId)
    .maybeSingle();
  if (error) {
    // 42P01: la 055 no corrió. No trabar por eso.
    console.error("[chat-contact] membership:", error.message);
    return null;
  }
  return membership
    ? null
    : "Esta persona no pertenece a tu comunidad, así que no se le puede iniciar una conversación desde acá.";
}
