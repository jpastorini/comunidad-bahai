"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BahaiStar } from "@/components/BahaiStar";
import { IconAEL, IconCalendario, IconHome } from "@/components/Icons";
import { InstallAppButton } from "@/components/InstallAppButton";
import { isPushSupported, subscribeToPush } from "@/lib/push-client";

type StepId = "welcome" | "notifications" | "install" | "tour";

/**
 * Asistente de bienvenida. Reglas de diseño para el público 60+:
 * una sola decisión por pantalla, botón primario grande, lenguaje de
 * persona (no de sistema), todo salteable, indicador de progreso.
 */
export function WelcomeWizard({
  firstName,
  localityName,
}: {
  firstName: string | null;
  localityName: string;
}) {
  const router = useRouter();
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushState, setPushState] = useState<
    "idle" | "busy" | "enabled" | "denied" | "failed"
  >("idle");
  const [stepIndex, setStepIndex] = useState(0);

  // El paso de notificaciones solo aparece si el navegador lo soporta
  // (en iPhone recién funciona con la app instalada, así que ahí se
  // muestra solo el paso de instalación).
  useEffect(() => {
    setPushAvailable(isPushSupported());
  }, []);

  const steps = useMemo<StepId[]>(
    () =>
      pushAvailable
        ? ["welcome", "notifications", "install", "tour"]
        : ["welcome", "install", "tour"],
    [pushAvailable]
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  function advance() {
    if (stepIndex >= steps.length - 1) {
      router.replace("/");
      return;
    }
    setStepIndex((i) => i + 1);
  }

  async function enableNotifications() {
    setPushState("busy");
    const result = await subscribeToPush();
    if (result === "enabled") {
      setPushState("enabled");
      // Micro-pausa para que se vea la confirmación antes de avanzar.
      setTimeout(advance, 900);
    } else if (result === "denied") {
      setPushState("denied");
    } else {
      setPushState("failed");
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gold-grad">
      <style>{`
        @keyframes bienvenida-in {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="pointer-events-none absolute -right-20 -top-24 opacity-[0.07]">
        <BahaiStar size={300} color="#fff" />
      </div>

      {/* Progreso */}
      <header
        className="relative px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? "w-6 bg-white" : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-white/60">
            Paso {stepIndex + 1} de {steps.length}
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div
          key={step}
          className="w-full max-w-md text-center"
          style={{ animation: "bienvenida-in 420ms ease-out both" }}
        >
          {step === "welcome" && (
            <>
              <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <BahaiStar size={44} color="#fff" />
              </div>
              <h1 className="font-display text-[32px] font-bold leading-tight text-white">
                {firstName ? `¡Hola, ${firstName}!` : "¡Te damos la bienvenida!"}
              </h1>
              <p className="mx-auto mt-4 max-w-sm font-body text-[16px] leading-relaxed text-white/85">
                Ya formás parte de la Comunidad Bahá'í de{" "}
                <strong className="text-white">{localityName}</strong> en la
                app. Antes de empezar, te mostramos un par de cosas.
              </p>
              <PrimaryButton onClick={advance}>Continuar</PrimaryButton>
            </>
          )}

          {step === "notifications" && (
            <>
              <StepIcon>
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </StepIcon>
              <h1 className="font-display text-[28px] font-bold leading-tight text-white">
                ¿Te avisamos cuando haya novedades?
              </h1>
              <p className="mx-auto mt-4 max-w-sm font-body text-[15px] leading-relaxed text-white/85">
                Cuando la Asamblea publique un comunicado o se acerque una
                Fiesta, te llega un aviso al teléfono. Tu dispositivo te va a
                pedir confirmación: tocá <strong className="text-white">Permitir</strong>.
              </p>

              {pushState === "enabled" ? (
                <p className="mt-8 text-[16px] font-semibold text-white">
                  ✓ ¡Listo! Avisos activados.
                </p>
              ) : pushState === "denied" ? (
                <>
                  <p className="mx-auto mt-6 max-w-sm rounded-2xl bg-white/10 px-4 py-3 text-[13px] leading-relaxed text-white/85">
                    Quedaron bloqueados en el navegador. No pasa nada: podés
                    activarlos más adelante desde tu perfil.
                  </p>
                  <PrimaryButton onClick={advance}>Continuar</PrimaryButton>
                </>
              ) : (
                <>
                  <PrimaryButton
                    onClick={enableNotifications}
                    disabled={pushState === "busy"}
                  >
                    {pushState === "busy" ? "Activando…" : "Sí, avisame"}
                  </PrimaryButton>
                  {pushState === "failed" && (
                    <p className="mt-3 text-[12px] text-white/75">
                      No se pudo activar. Podés intentarlo después desde tu
                      perfil.
                    </p>
                  )}
                  <SkipButton onClick={advance}>Ahora no</SkipButton>
                </>
              )}
            </>
          )}

          {step === "install" && (
            <>
              <StepIcon>
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                  <path d="M11 18h2" />
                </svg>
              </StepIcon>
              <h1 className="font-display text-[28px] font-bold leading-tight text-white">
                Llevala en tu pantalla de inicio
              </h1>
              <p className="mx-auto mt-4 max-w-sm font-body text-[15px] leading-relaxed text-white/85">
                Instalá la app para abrirla con un toque, como cualquier otra
                aplicación de tu teléfono.
              </p>
              <div className="mt-6 text-left">
                <InstallAppButton />
              </div>
              <PrimaryButton onClick={advance}>Continuar</PrimaryButton>
              <p className="mt-3 text-[12px] text-white/70">
                Si ya la instalaste (o preferís hacerlo después desde tu
                perfil), seguí adelante.
              </p>
            </>
          )}

          {step === "tour" && (
            <>
              <h1 className="font-display text-[28px] font-bold leading-tight text-white">
                Esto es lo esencial
              </h1>
              <div className="mx-auto mt-6 grid max-w-sm gap-3 text-left">
                <TourRow
                  icon={<IconHome size={22} />}
                  title="Inicio"
                  detail="Lo último de tu comunidad: comunicados, próximos eventos y fotos."
                />
                <TourRow
                  icon={<IconCalendario size={22} />}
                  title="Calendario"
                  detail="Fiestas de 19 Días, Días Sagrados y actividades, con fecha y lugar."
                />
                <TourRow
                  icon={<IconAEL size={22} />}
                  title="AEL"
                  detail="Todo lo de tu Asamblea: comunicados, boletín y chat con la Secretaría."
                />
              </div>
              <p className="mx-auto mt-5 max-w-sm text-[13px] leading-relaxed text-white/75">
                Las secciones están siempre abajo de la pantalla.
              </p>
              <PrimaryButton onClick={advance}>Empezar a usar la app</PrimaryButton>
            </>
          )}
        </div>
      </main>
    </div>
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
      className="tap mt-8 w-full rounded-2xl bg-white px-6 py-4 text-[17px] font-bold text-gold-dark shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)] transition active:scale-[0.98] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SkipButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap mt-4 text-[14px] font-medium text-white/75 underline underline-offset-2"
    >
      {children}
    </button>
  );
}

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25">
      {children}
    </div>
  );
}

function TourRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl bg-white/10 px-4 py-3.5 ring-1 ring-white/15">
      <span className="mt-0.5 shrink-0 text-white">{icon}</span>
      <span>
        <span className="block text-[15px] font-bold text-white">{title}</span>
        <span className="block text-[12.5px] leading-relaxed text-white/80">
          {detail}
        </span>
      </span>
    </div>
  );
}
