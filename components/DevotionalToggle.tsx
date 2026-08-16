"use client";

import { useState, useTransition } from "react";
import {
  setDevotionalPrefAction,
  type DevotionalPref,
} from "@/app/(app)/perfil/actions";
import { isPushSupported, subscribeToPush } from "@/lib/push-client";

type Props = {
  pref: DevotionalPref;
  initialEnabled: boolean;
  title: string;
  description: string;
  /** Texto del botón grande en la variante "button". */
  callToAction?: string;
  enabledLabel?: string;
  /**
   * "row"    → fila con switch, para la lista de ajustes del perfil.
   * "button" → botón grande, para ofrecerlo donde nace la intención
   *            (la pantalla de la Oración Obligatoria).
   */
  variant?: "row" | "button";
};

/**
 * Prende/apaga un recordatorio devocional. Al prenderlo se asegura de que
 * el dispositivo tenga la suscripción push activa: sin eso el recordatorio
 * quedaría guardado pero nunca llegaría.
 */
export function DevotionalToggle({
  pref,
  initialEnabled,
  title,
  description,
  callToAction = "Activar",
  enabledLabel = "Activado",
  variant = "row",
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setNotice(null);
    startTransition(async () => {
      if (next && isPushSupported()) {
        // Solo pide permiso si todavía no lo dio; si ya está suscrito,
        // subscribeToPush() es idempotente del lado del servidor.
        const result = await subscribeToPush();
        if (result === "denied") {
          setNotice(
            "Los avisos están bloqueados en este navegador. Habilitalos en los ajustes del sitio para recibir el recordatorio."
          );
        } else if (result === "unsupported") {
          setNotice(
            "Este dispositivo no puede recibir avisos. En iPhone hay que instalar la app en la pantalla de inicio."
          );
        }
      }
      const res = await setDevotionalPrefAction(pref, next);
      if (res.ok) {
        setEnabled(next);
      } else {
        setNotice(res.error);
      }
    });
  }

  if (variant === "button") {
    return (
      <div>
        <button
          type="button"
          onClick={() => toggle(!enabled)}
          disabled={pending}
          className={
            enabled
              ? "tap inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.08] px-3.5 py-2 text-[12px] font-semibold text-gold-dark disabled:opacity-60"
              : "tap inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10 disabled:opacity-60"
          }
        >
          <BellIcon />
          {pending ? "Guardando…" : enabled ? enabledLabel : callToAction}
        </button>
        {enabled && !pending && (
          <button
            type="button"
            onClick={() => toggle(false)}
            className="tap ml-3 text-[11.5px] font-medium text-muted underline underline-offset-2"
          >
            Quitar recordatorio
          </button>
        )}
        {notice && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-amber-700">
            {notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card px-4 py-3 shadow-card-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-dark">{title}</div>
          <div className="text-[11px] leading-relaxed text-muted">
            {description}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          onClick={() => toggle(!enabled)}
          disabled={pending}
          className={`tap relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-terra" : "bg-black/15"
          }`}
        >
          <span
            className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${
              enabled ? "left-[23px]" : "left-[3px]"
            }`}
          />
        </button>
      </div>
      {notice && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-amber-700">
          {notice}
        </p>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
