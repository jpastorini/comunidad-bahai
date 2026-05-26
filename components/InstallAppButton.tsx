"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Botón "Instalar App". Solo se muestra si la app NO está instalada:
 *   - Android/Chrome: captura `beforeinstallprompt` y dispara el instalador.
 *   - iOS/Safari: muestra instrucciones (no hay instalación programática).
 * Se oculta si ya corre en modo standalone (instalada) o tras instalar.
 */
export function InstallAppButton() {
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    const onInstalled = () => {
      setMode("hidden");
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS no dispara beforeinstallprompt: mostramos instrucciones.
    if (isIOS()) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleAndroidInstall() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* el usuario cerró el diálogo */
    }
    setDeferred(null);
    setMode("hidden");
  }

  if (mode === "hidden") return null;

  return (
    <div className="mb-3.5 rounded-[14px] bg-card p-3.5 shadow-card-soft">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-terra"
          style={{ background: "#2A3F8F10" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-dark">
            Instalá la app
          </div>
          <div className="text-[11px] text-muted">
            Acceso directo desde tu pantalla de inicio y notificaciones.
          </div>
        </div>
        {mode === "android" ? (
          <button
            type="button"
            onClick={handleAndroidInstall}
            className="tap shrink-0 rounded-xl bg-terra px-3.5 py-2 text-[12px] font-semibold text-white shadow-card-soft hover:bg-terra-light"
          >
            Instalar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIosHelp((v) => !v)}
            className="tap shrink-0 rounded-xl border border-black/10 bg-card px-3.5 py-2 text-[12px] font-semibold text-dark hover:bg-bg"
          >
            Cómo instalar
          </button>
        )}
      </div>

      {mode === "ios" && showIosHelp && (
        <div className="mt-3 rounded-xl bg-bg/60 px-3.5 py-3 text-[12px] leading-relaxed text-dark">
          <p className="mb-1.5">Para instalarla en tu iPhone:</p>
          <ol className="ml-4 list-decimal space-y-1 text-muted">
            <li>
              Tocá el botón <strong className="text-dark">Compartir</strong>{" "}
              <span className="inline-flex translate-y-0.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4" />
                  <path d="m8 8 4-4 4 4" />
                  <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" />
                </svg>
              </span>{" "}
              en la barra de Safari.
            </li>
            <li>
              Elegí{" "}
              <strong className="text-dark">
                "Añadir a pantalla de inicio"
              </strong>
              .
            </li>
            <li>
              Confirmá con <strong className="text-dark">Añadir</strong>.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
