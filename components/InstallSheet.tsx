"use client";

import { useEffect, useState } from "react";

/**
 * Hoja de instalación de la PWA. Aparece sola, tapando la pantalla, cuando
 * alguien entra desde el navegador del celular sin tener la app instalada.
 * Es el pedido de la comunidad: la tarjeta discreta del perfil no la veía
 * nadie. Reglas de diseño del asistente de bienvenida: una decisión por
 * pantalla, botón grande, lenguaje de persona.
 *
 * Cuándo se muestra:
 *   - Solo en celular (Android o iPhone/iPad). En PC la instalación no es
 *     lo que la gente espera y la tarjeta del perfil alcanza.
 *   - Solo si NO corre instalada (display-mode standalone).
 *   - Android: solo si el navegador disparó `beforeinstallprompt`, que es
 *     la única señal de que la instalación es posible. Si no dispara (ya
 *     instalada, navegador sin soporte) no se muestra nada: sería un
 *     callejón sin salida.
 *   - iOS: Safari no avisa nada; se muestran los pasos. Se saltea a los
 *     webviews (WhatsApp, Instagram) porque ahí no hay "Añadir a pantalla
 *     de inicio".
 *   - "Ahora no" la esconde 3 días (localStorage). Sin límite de veces: la
 *     insistencia es deliberada, la tarjeta del perfil queda como camino
 *     manual.
 *
 * Confirmación: en Android llega `appinstalled` y la hoja pasa a "Listo".
 * En iOS no hay evento, así que el botón "Ya la instalé" lleva a la misma
 * pantalla. La próxima vez que abran desde el ícono ya corre standalone
 * y la hoja no existe.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SNOOZE_KEY = "cb-install-snooze-until";
const SNOOZE_DAYS = 3;
/** Tras "Ya la instalé" / "Entendido": si siguen usando el navegador igual,
 *  no volver a insistir por un mes. */
const DONE_DAYS = 30;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

function ua(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(ua());
}

function isAndroid(): boolean {
  return /android/i.test(ua());
}

/** Safari o Chrome/Firefox de iOS tienen "Safari" en el UA y menú Compartir
 *  con "Añadir a pantalla de inicio"; los webviews de otras apps no. */
function isIOSBrowserWithShare(): boolean {
  return isIOS() && /safari/i.test(ua());
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

type Mode = "hidden" | "android" | "ios" | "done";

export function InstallSheet() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isAndroid() && !isIOS()) return;
    if (isSnoozed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode((m) => (m === "done" ? m : "android"));
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode("done");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // En iOS no hay evento: se muestra tras un respiro, para que la
    // pantalla de atrás alcance a pintarse y la hoja se vea subir.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIOSBrowserWithShare()) {
      timer = setTimeout(() => setMode("ios"), 700);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
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

  function finish() {
    snooze(DONE_DAYS);
    setMode("hidden");
  }

  async function installAndroid() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // Si aceptó, `appinstalled` trae la confirmación. Si cerró el diálogo
      // nativo, cuenta como "ahora no".
      if (outcome !== "accepted") dismiss();
    } catch {
      dismiss();
    } finally {
      setBusy(false);
      setDeferred(null);
    }
  }

  if (mode === "hidden") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cb-install-title"
      onClick={mode === "done" ? finish : dismiss}
    >
      <div
        className="cb-sheet-up max-h-[calc(94dvh/var(--ui-zoom,1))] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-card px-6 pt-7 text-center shadow-[0_-10px_40px_rgba(0,0,0,0.25)]"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "done" ? (
          <DoneView onClose={finish} />
        ) : (
          <>
            <img
              src="/icons/icon-192.png"
              alt=""
              width={84}
              height={84}
              className="mx-auto h-[84px] w-[84px] rounded-[22px] shadow-card-elevated"
            />
            <h2
              id="cb-install-title"
              className="mt-5 font-display text-[26px] font-bold leading-tight text-dark"
            >
              Instalá la app en tu teléfono
            </h2>
            <p className="mx-auto mt-3 max-w-xs font-body text-[15px] leading-relaxed text-muted">
              Queda en tu pantalla de inicio como cualquier otra aplicación:
              se abre con un toque y te llegan los avisos de tu comunidad.
            </p>

            {mode === "android" ? (
              <PrimaryButton onClick={installAndroid} disabled={busy}>
                {busy ? "Abriendo el instalador…" : "Instalar ahora"}
              </PrimaryButton>
            ) : (
              <>
                <IosSteps />
                <PrimaryButton onClick={finish}>Ya la instalé</PrimaryButton>
              </>
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
        id="cb-install-title"
        className="mt-5 font-display text-[26px] font-bold leading-tight text-dark"
      >
        ¡Listo! Ya está instalada
      </h2>
      <p className="mx-auto mt-3 max-w-xs font-body text-[15px] leading-relaxed text-muted">
        Buscá el ícono de la app en tu pantalla de inicio. Ya podés cerrar el
        navegador: de ahora en más, abrila desde ahí.
      </p>
      <PrimaryButton onClick={onClose}>Entendido</PrimaryButton>
    </>
  );
}

function IosSteps() {
  return (
    <ol className="mx-auto mt-6 grid max-w-xs gap-3 text-left">
      <IosStep n={1}>
        Tocá <strong className="text-dark">Compartir</strong>{" "}
        <span className="inline-flex translate-y-0.5 text-terra">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4" />
            <path d="m8 8 4-4 4 4" />
            <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" />
          </svg>
        </span>{" "}
        en la barra del navegador.
      </IosStep>
      <IosStep n={2}>
        Elegí{" "}
        <strong className="text-dark">Añadir a pantalla de inicio</strong>{" "}
        <span className="inline-flex translate-y-0.5 text-terra">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </span>
      </IosStep>
      <IosStep n={3}>
        Confirmá con <strong className="text-dark">Añadir</strong>, arriba a
        la derecha.
      </IosStep>
    </ol>
  );
}

function IosStep({ n, children }: { n: number; children: React.ReactNode }) {
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
