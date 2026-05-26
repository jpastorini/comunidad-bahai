"use client";

import { useEffect, useState } from "react";

type State =
  | "loading"
  | "unsupported"
  | "default" // soportado, no suscrito
  | "enabled"
  | "denied"
  | "busy";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // navigator.serviceWorker.ready solo resuelve si hay un SW activo
  // (en producción; en dev next-pwa lo desactiva). Cortamos con timeout.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        typeof Notification !== "undefined" &&
        Boolean(VAPID_PUBLIC_KEY);
      if (!supported) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      const reg = await getReadyRegistration();
      if (cancelled) return;
      if (!reg) {
        setState("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setState(sub ? "enabled" : "default");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }
      const reg = await getReadyRegistration();
      if (!reg) {
        setState("unsupported");
        return;
      }
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
      setState(res.ok ? "enabled" : "default");
    } catch (err) {
      console.error("[push] enable error:", err);
      setState("default");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await getReadyRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch (err) {
      console.error("[push] disable error:", err);
      setState("enabled");
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-card-soft">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-dark">
          Notificaciones del chat
        </div>
        <div className="text-[11px] text-muted">
          {state === "denied"
            ? "Bloqueadas en el navegador. Habilitalas en los ajustes del sitio."
            : state === "enabled"
              ? "Activadas en este dispositivo."
              : "Recibí un aviso aunque la app esté cerrada."}
        </div>
      </div>
      {state === "denied" ? null : state === "enabled" ? (
        <button
          type="button"
          onClick={disable}
          disabled={state !== "enabled"}
          className="tap shrink-0 rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12px] font-semibold text-dark hover:bg-bg"
        >
          Desactivar
        </button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={state === "busy" || state === "loading"}
          className="tap shrink-0 rounded-xl bg-terra px-3.5 py-2 text-[12px] font-semibold text-white shadow-card-soft hover:bg-terra-light disabled:opacity-60"
        >
          {state === "busy" ? "Activando…" : "Activar"}
        </button>
      )}
    </div>
  );
}
