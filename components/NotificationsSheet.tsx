"use client";

import { useEffect, useState } from "react";
import {
  ensurePushSubscription,
  getPushStatus,
  subscribeToPush,
} from "@/lib/push-client";
import { isStandalone } from "@/lib/standalone";

/**
 * Hoja de avisos: la gemela de InstallSheet para las notificaciones.
 * Sube sola, tapando la pantalla, cuando la app corre INSTALADA y todavía
 * no tiene los avisos activados. Existe porque el paso de notificaciones
 * del asistente de bienvenida corre en el navegador, antes de instalar, y
 * en iPhone el push solo funciona desde la app instalada: la primera
 * apertura desde el ícono es el primer momento en que se puede pedir, y
 * hasta ahora ahí no aparecía nada.
 *
 * Lo que NO se puede hacer, y por qué la hoja tiene un botón: ningún
 * navegador deja activar notificaciones sin un diálogo del sistema, y ese
 * diálogo solo se puede abrir desde un toque de la persona. Lo único que
 * está en nuestras manos es que el pedido sea inevitable y llegue en el
 * momento correcto.
 *
 * Cuándo se muestra:
 *   - Solo con la app instalada (standalone). En el navegador la hoja de
 *     instalación va primero; las dos no se pisan nunca porque una actúa
 *     sin instalar y la otra instalada.
 *   - Solo si el navegador soporta push (iPhone: iOS 16.4 o más nuevo).
 *   - Permiso "default" → pide activar. Permiso "denied" → explica cómo
 *     desbloquearlo en los ajustes del teléfono (el navegador no deja
 *     volver a preguntar). Permiso concedido → no se muestra: si falta la
 *     suscripción, la crea en silencio (ver abajo).
 *   - "Ahora no" la esconde 3 días (localStorage), sin límite de veces,
 *     igual que la instalación. La insistencia es deliberada: el
 *     interruptor del perfil queda como camino manual.
 *
 * Autorreparación: con permiso concedido, cada apertura (a lo sumo una vez
 * por día) vuelve a registrar la suscripción en el servidor y la recrea si
 * el navegador la perdió. Así una suscripción muerta no deja a alguien sin
 * avisos sin que nadie se entere.
 */

const SNOOZE_KEY = "cb-push-snooze-until";
const SNOOZE_DAYS = 3;
const SYNC_DAY_KEY = "cb-push-synced-day";

function ua(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(ua());
}
function isAndroid(): boolean {
  return /android/i.test(ua());
}

function isSnoozed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function snooze(days: number) {
  try {
    window.localStorage.setItem(
      SNOOZE_KEY,
      String(Date.now() + days * 24 * 60 * 60 * 1000)
    );
  } catch {
    // Sin localStorage la hoja vuelve la próxima vez; no es grave.
  }
}

/** ¿Ya se sincronizó la suscripción hoy en este dispositivo? Marca el día. */
function syncedToday(): boolean {
  const today = new Date().toDateString();
  try {
    if (window.localStorage.getItem(SYNC_DAY_KEY) === today) return true;
    window.localStorage.setItem(SYNC_DAY_KEY, today);
  } catch {
    // Sin localStorage se sincroniza en cada apertura; es idempotente.
  }
  return false;
}

type Mode = "hidden" | "ask" | "blocked" | "done";
type Platform = "ios" | "android" | "other";

export function NotificationsSheet({
  isBahai = true,
}: {
  /** false = Amigo/a de la Fe (047): la lista no le promete la Fiesta. */
  isBahai?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // `?avisos=pedir` / `?avisos=bloqueado` fuerzan la hoja en el navegador,
    // que es como se prueba sin instalar (mismo truco que `?splash=1`).
    const forced = new URLSearchParams(window.location.search).get("avisos");
    if (forced === "pedir" || forced === "bloqueado") {
      timer = setTimeout(
        () => setMode(forced === "bloqueado" ? "blocked" : "ask"),
        300
      );
      return () => clearTimeout(timer);
    }
    if (!isStandalone()) return;

    (async () => {
      const status = await getPushStatus();
      if (cancelled) return;

      if (status === "subscribed" || status === "granted-unsubscribed") {
        // Permiso concedido: nada que preguntar. Reparar en silencio.
        if (status === "granted-unsubscribed" || !syncedToday()) {
          void ensurePushSubscription();
        }
        return;
      }
      if (status === "unsupported" || isSnoozed()) return;

      // Tras un respiro, para que la pantalla de atrás alcance a pintarse
      // y la hoja se vea subir. Si está corriendo la splash de arranque
      // (data-splash en <html>, ~2,4 s), esperar a que termine.
      const splash = document.documentElement.hasAttribute("data-splash");
      timer = setTimeout(
        () => setMode(status === "denied" ? "blocked" : "ask"),
        splash ? 2700 : 700
      );
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Mientras la hoja está abierta, la pantalla de atrás no se desplaza.
  useEffect(() => {
    if (mode === "hidden") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode]);

  function dismiss() {
    snooze(SNOOZE_DAYS);
    setMode("hidden");
  }

  function close() {
    setMode("hidden");
  }

  async function enable() {
    setBusy(true);
    setFailed(false);
    const result = await subscribeToPush();
    setBusy(false);
    if (result === "enabled") {
      setMode("done");
    } else if (result === "denied") {
      setMode("blocked");
    } else {
      // "failed" o "unsupported" en pleno intento: se puede volver a probar.
      setFailed(true);
    }
  }

  if (mode === "hidden") return null;

  const platform: Platform = isIOS()
    ? "ios"
    : isAndroid()
      ? "android"
      : "other";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cb-push-title"
      onClick={mode === "done" ? close : dismiss}
    >
      <div
        className="cb-sheet-up max-h-[calc(94dvh/var(--ui-zoom,1))] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-card px-6 pt-7 text-center shadow-[0_-10px_40px_rgba(0,0,0,0.25)]"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "done" ? (
          <DoneView onClose={close} />
        ) : mode === "blocked" ? (
          <BlockedView platform={platform} onClose={dismiss} />
        ) : (
          <>
            <BellBadge />
            <h2
              id="cb-push-title"
              className="mt-5 font-display text-[26px] font-bold leading-tight text-dark"
            >
              Activá los avisos de tu comunidad
            </h2>
            <p className="mx-auto mt-3 max-w-xs font-body text-[15px] leading-relaxed text-muted">
              Así te enterás aunque la app esté cerrada:
            </p>
            <ul className="mx-auto mt-4 grid max-w-xs gap-2 text-left">
              <Item>Comunicados de la Asamblea</Item>
              <Item>
                {isBahai
                  ? "Recordatorio de la Fiesta y de los eventos"
                  : "Recordatorio de los eventos"}
              </Item>
              <Item>La Lectura de hoy, cada mañana</Item>
              <Item>Respuestas de Secretaría a tus mensajes</Item>
            </ul>

            <PrimaryButton onClick={enable} disabled={busy}>
              {busy ? "Un momento…" : "Activar avisos"}
            </PrimaryButton>
            {failed ? (
              <p className="mt-3 text-[13px] font-medium text-red-600">
                No se pudieron activar. Probá de nuevo en un rato.
              </p>
            ) : (
              <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-muted">
                Tu teléfono te va a preguntar si permitís las notificaciones.
                Tocá <strong className="text-dark">Permitir</strong>.
              </p>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="tap mt-4 py-2 text-[15px] font-medium text-muted underline underline-offset-2"
            >
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DoneView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-full bg-terra text-white shadow-card-elevated">
        <svg
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h2
        id="cb-push-title"
        className="mt-5 font-display text-[26px] font-bold leading-tight text-dark"
      >
        ¡Listo! Ya te van a llegar los avisos
      </h2>
      <p className="mx-auto mt-3 max-w-xs font-body text-[15px] leading-relaxed text-muted">
        Los podés apagar cuando quieras desde tu perfil, en la sección de
        avisos.
      </p>
      <PrimaryButton onClick={onClose}>Entendido</PrimaryButton>
    </>
  );
}

function BlockedView({
  platform,
  onClose,
}: {
  platform: Platform;
  onClose: () => void;
}) {
  return (
    <>
      <BellBadge muted />
      <h2
        id="cb-push-title"
        className="mt-5 font-display text-[26px] font-bold leading-tight text-dark"
      >
        Los avisos están bloqueados
      </h2>
      <p className="mx-auto mt-3 max-w-xs font-body text-[15px] leading-relaxed text-muted">
        En algún momento se le dijo que no a las notificaciones. Se pueden
        volver a permitir desde los ajustes del teléfono:
      </p>
      <ol className="mx-auto mt-6 grid max-w-xs gap-3 text-left">
        {platform === "ios" ? (
          <>
            <Step n={1}>
              Abrí <strong className="text-dark">Ajustes</strong> del iPhone y
              tocá <strong className="text-dark">Notificaciones</strong>.
            </Step>
            <Step n={2}>
              Buscá{" "}
              <strong className="text-dark">Comunidad Bahá&rsquo;í</strong> en
              la lista.
            </Step>
            <Step n={3}>
              Prendé{" "}
              <strong className="text-dark">Permitir notificaciones</strong>.
            </Step>
          </>
        ) : platform === "android" ? (
          <>
            <Step n={1}>
              Mantené apretado el <strong className="text-dark">ícono</strong>{" "}
              de la app en la pantalla de inicio.
            </Step>
            <Step n={2}>
              Tocá{" "}
              <strong className="text-dark">Información de la app</strong>.
            </Step>
            <Step n={3}>
              Entrá en <strong className="text-dark">Notificaciones</strong> y
              prendelas.
            </Step>
          </>
        ) : (
          <Step n={1}>
            Tocá el candado en la barra de direcciones y permití las
            notificaciones para este sitio.
          </Step>
        )}
      </ol>
      <p className="mx-auto mt-4 max-w-xs text-[13px] leading-relaxed text-muted">
        Cuando vuelvas a abrir la app, los avisos quedan activados solos.
      </p>
      <PrimaryButton onClick={onClose}>Entendido</PrimaryButton>
    </>
  );
}

function BellBadge({ muted = false }: { muted?: boolean }) {
  return (
    <div
      className={`mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-[22px] shadow-card-elevated ${
        muted ? "bg-bg text-muted" : "bg-terra text-white"
      }`}
    >
      <svg
        width="42"
        height="42"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        {muted ? <path d="M3 3l18 18" /> : null}
      </svg>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-bg px-4 py-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-terra/10 text-terra">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="text-[15px] leading-relaxed text-dark">{children}</span>
    </li>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-bg px-4 py-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terra text-[14px] font-bold text-white">
        {n}
      </span>
      <span className="text-[15px] leading-relaxed text-muted">{children}</span>
    </li>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap mt-7 w-full rounded-2xl bg-terra px-6 py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(42,63,143,0.6)] transition active:scale-[0.98] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
