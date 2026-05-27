import "server-only";
import webpush from "web-push";
import { createSupabaseAdmin } from "./supabase/admin";

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
  localityId: string
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("locality_id", localityId);
  return ((data ?? []) as Array<{ id: string }>).map((d) => d.id);
}

/** IDs de los admins con tag de chat en una localidad (para avisar mensajes
 *  entrantes). Usa service-role para no chocar con RLS de profiles. */
export async function getChatAdminIds(
  localityId: string,
  excludeUserId?: string
): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("locality_id", localityId)
    .eq("can_respond_chat", true);
  return ((data ?? []) as Array<{ id: string }>)
    .map((d) => d.id)
    .filter((id) => id !== excludeUserId);
}
