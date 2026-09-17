import "server-only";
import webpush from "web-push";
import { getLocalityMembers } from "./memberships";
import { createSupabaseAdmin } from "./supabase/admin";
import type { ChatTopic } from "./types";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:notificaciones@comunidadbahai.app";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

/**
 * Envía una notificación Web Push a todas las suscripciones de los
 * usuarios dados. Limpia las suscripciones muertas (404/410). No-op si
 * faltan las claves VAPID o la service-role key. Nunca lanza — un fallo
 * de push no debe romper el envío del mensaje.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  try {
    if (!ensureConfigured() || userIds.length === 0) return;
    const supabase = createSupabaseAdmin();
    if (!supabase) return;

    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    const subs = (data ?? []) as Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            // Suscripción expirada/cancelada → la borramos.
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error("[push] sendNotification error:", code ?? err);
          }
        }
      })
    );
  } catch (err) {
    console.error("[push] sendPushToUsers error:", err);
  }
}

/** IDs de TODOS los miembros de una localidad (para avisar un comunicado
 *  nuevo). Usa service-role para no chocar con RLS de profiles. */
export async function getLocalityMemberIds(
  localityId: string,
  opts: {
    /**
     * Solo creyentes (047): lo que un Amigo/a de la Fe no puede leer
     * tampoco se le avisa — comunicados "solo creyentes", Boletín,
     * recordatorio de una Fiesta cargada a mano en el calendario.
     */
    bahaiOnly?: boolean;
  } = {}
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  // ⚠️ Por MEMBRESÍA, no por el sombrero puesto (056). Quien pertenece a
  // dos comunidades tiene que recibir el aviso de las dos, ande con el
  // sombrero que ande. Preguntarle a `profiles.locality_id` lo dejaba
  // afuera de una de ellas sin que nadie se enterara.
  const members = await getLocalityMembers(supabase, localityId);
  return members
    .filter((m) => (opts.bahaiOnly ? m.is_bahai : true))
    .map((m) => m.id);
}

/**
 * IDs de TODAS las personas del país (para un comunicado de la Asamblea
 * Nacional, 057). Sale de `profiles` y no de las membresías porque cada
 * persona tiene una sola fila ahí: así nadie recibe el aviso dos veces
 * por pertenecer a su AEL y a la Comunidad Nacional.
 */
export async function getAllMemberIds(
  opts: { bahaiOnly?: boolean } = {}
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  let query = supabase.from("profiles").select("id").is("disabled_at", null);
  if (opts.bahaiOnly) query = query.eq("is_bahai", true);
  const { data, error } = await query;
  if (error) {
    console.error("[push] getAllMemberIds:", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ id: string }>).map((d) => d.id);
}

/** Alcance de push de una localidad: cuántos de sus miembros tienen al
 *  menos una suscripción activa, sobre el total. Usa service-role porque la
 *  RLS de push_subscriptions solo deja ver las propias. */
export async function getLocalityPushReach(
  localityId: string
): Promise<{ withPush: number; total: number }> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return { withPush: 0, total: 0 };

  const memberIds = (await getLocalityMembers(supabase, localityId)).map(
    (m) => m.id
  );
  if (memberIds.length === 0) return { withPush: 0, total: 0 };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .in("user_id", memberIds);
  const withPush = new Set(
    ((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id)
  ).size;

  return { withPush, total: memberIds.length };
}

/** IDs de los miembros de la Asamblea (role='admin') de una localidad
 *  (para avisar reuniones AEL). Usa service-role para no chocar con RLS. */
export async function getLocalityAdminIds(
  localityId: string
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  // El rol es el de la MEMBRESÍA: alguien puede ser de la Asamblea acá y
  // creyente común en su otra comunidad (056).
  const members = await getLocalityMembers(supabase, localityId);
  return members.filter((m) => m.role === "admin").map((m) => m.id);
}

/** IDs de quienes atienden un canal del chat en una localidad (para avisar
 *  mensajes entrantes). Cada tema tiene su tag: 'secretaria' avisa a los
 *  `can_respond_chat`, 'tesoreria' a los `can_manage_treasury`. Usa
 *  service-role para no chocar con RLS de profiles. */
export async function getChatAdminIds(
  localityId: string,
  excludeUserId?: string,
  topic: ChatTopic = "secretaria"
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  // Los tags también son de la membresía (056): el tesorero nacional
  // atiende el chat de la Comunidad Nacional y no el de su AEL.
  const members = await getLocalityMembers(supabase, localityId);
  return members
    .filter((m) =>
      topic === "tesoreria" ? m.can_manage_treasury : m.can_respond_chat
    )
    .map((m) => m.id)
    .filter((id) => id !== excludeUserId);
}
