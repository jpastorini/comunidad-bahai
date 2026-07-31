"use client";

// ─── Web Push, lado cliente ──────────────────────────────────────
// Helpers compartidos entre el toggle de notificaciones (perfil) y el
// asistente de bienvenida. Server-side ver lib/push.ts.

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

export type SubscribeResult = "enabled" | "denied" | "unsupported" | "failed";

/**
 * Pide permiso de notificaciones, crea la suscripción push y la
 * registra en el servidor. Nunca lanza.
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
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY
      ) as BufferSource,
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok ? "enabled" : "failed";
  } catch (err) {
    console.error("[push] subscribe error:", err);
    return "failed";
  }
}
