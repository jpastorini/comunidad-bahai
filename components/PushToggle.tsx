"use client";

import { useEffect, useState } from "react";
import {
  getReadyRegistration,
  isPushSupported,
  subscribeToPush,
} from "@/lib/push-client";

type State =
  | "loading"
  | "unsupported"
  | "default" // soportado, no suscrito
  | "enabled"
  | "denied"
  | "busy";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) {
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
    setState("busy");
    const result = await subscribeToPush();
    setState(
      result === "enabled"
        ? "enabled"
        : result === "denied"
          ? "denied"
          : result === "unsupported"
            ? "unsupported"
            : "default"
    );
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
