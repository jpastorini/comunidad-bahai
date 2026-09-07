"use client";

// ─── Web Push, lado cliente ──────────────────────────────────────
// Helpers compartidos entre el toggle de notificaciones (perfil), el
// asistente de bienvenida y la hoja de avisos (NotificationsSheet).
// Server-side ver lib/push.ts.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** ¿Este navegador soporta Web Push (y tenemos la clave VAPID)? */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined" &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

export async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // navigator.serviceWorker.ready solo resuelve si hay un SW activo
  // (en producción; en dev next-pwa lo desactiva). Cortamos con timeout.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
}

/** Registra (o refresca) la suscripción en el servidor. Idempotente. */
async function registerOnServer(sub: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

export type SubscribeResult = "enabled" | "denied" | "unsupported" | "failed";

/**
 * Pide permiso de notificaciones, crea la suscripción push y la
 * registra en el servidor. Nunca lanza. Tiene que correr desde un gesto
 * de la persona (un toque): sin eso el navegador ignora el pedido.
 * Si el permiso ya estaba concedido no muestra ningún diálogo.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return permission === "denied" ? "denied" : "failed";
    }
    const reg = await getReadyRegistration();
    if (!reg) return "unsupported";
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as BufferSource,
      }));
    return (await registerOnServer(sub)) ? "enabled" : "failed";
  } catch (err) {
    console.error("[push] subscribe error:", err);
    return "failed";
  }
}

export type PushStatus =
  /** Sin soporte en este navegador (o sin SW activo, o sin clave VAPID). */
  | "unsupported"
  /** La persona bloqueó las notificaciones: no se puede volver a pedir. */
  | "denied"
  /** Soportado y nunca se pidió: se puede preguntar. */
  | "default"
  /** Permiso concedido y suscripción viva en este dispositivo. */
  | "subscribed"
  /** Permiso concedido pero sin suscripción (se perdió o nunca se creó):
   *  se puede suscribir sin mostrar ningún diálogo. */
  | "granted-unsubscribed";

/** Estado del push en este dispositivo, sin pedir nada. Nunca lanza. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await getReadyRegistration();
  if (!reg) return "unsupported";
  if (Notification.permission !== "granted") return "default";
  try {
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "granted-unsubscribed";
  } catch {
    return "granted-unsubscribed";
  }
}

/**
 * Autorreparación silenciosa: con el permiso ya concedido, se asegura de
 * que exista una suscripción y de que el servidor la tenga registrada a
 * nombre de quien está logueado. No muestra diálogos. Nunca lanza.
 * Devuelve true si al terminar hay una suscripción registrada.
 */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const reg = await getReadyRegistration();
    if (!reg) return false;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as BufferSource,
      }));
    return await registerOnServer(sub);
  } catch (err) {
    console.error("[push] ensure error:", err);
    return false;
  }
}
