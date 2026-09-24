"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BahaiStar } from "./BahaiStar";

/**
 * Tirar para actualizar, para toda la app del creyente.
 *
 * Existe porque en la PWA instalada no había forma de refrescar: no hay
 * barra ni botón de recarga, y `overscroll-behavior-y: contain`
 * (globals.css) apaga el gesto nativo de Chrome en Android. Ese
 * `contain` se queda a propósito: el nativo recarga la página entera
 * (splash, JS, todo), y este solo pide los datos (`router.refresh()`),
 * que es lo que la persona quiere cuando tira.
 *
 * Un solo componente en el layout escucha los toques del documento y
 * actúa sobre el `.scroll-area` donde empezó el gesto, así que cualquier
 * pantalla con ese contenedor lo tiene sin hacer nada. Solo arranca si esa
 * lista está arriba del todo, si el gesto es vertical, y nunca adentro de
 * algo fijo (el visor de fotos, las hojas de instalación y de avisos) ni
 * de un campo de texto.
 *
 * El indicador (la estrella) se mueve por ref, sin pasar por React en cada
 * toque, por la misma razón que el zoom de las fotos: re-renderizar a 60
 * cuadros por segundo se siente pegajoso en un celular viejo. React solo
 * se entera de "está actualizando".
 */

/** Cuánto hay que tirar (px) para que suelte y actualice. */
const THRESHOLD = 70;
/** Hasta dónde baja la estrella como mucho. */
const MAX_PULL = 110;
/** Tiempo mínimo girando: si la respuesta llega en 80 ms, un parpadeo no
 *  le dice a nadie que se actualizó. */
const MIN_SPIN_MS = 600;

export function PullToRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const clipRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLDivElement>(null);
  const spinStartedAt = useRef(0);
  const refreshingRef = useRef(false);

  // Fin de la actualización: cuando la transición del refresh terminó y
  // pasó el tiempo mínimo, la estrella vuelve a esconderse.
  useEffect(() => {
    if (!refreshing || isPending) return;
    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - spinStartedAt.current));
    const t = window.setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      place(0, true);
    }, wait);
    return () => window.clearTimeout(t);
  }, [refreshing, isPending]);

  function place(offset: number, animate: boolean) {
    const knob = knobRef.current;
    if (!knob) return;
    knob.style.transition = animate ? "transform 351ms cubic-bezier(0.2,0.8,0.3,1), opacity 270ms ease" : "none";
    knob.style.transform = `translate(-50%, ${offset - 48}px)`;
    knob.style.opacity = offset > 4 ? "1" : "0";
  }

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let scrollEl: HTMLElement | null = null;
    /** null = todavía no se sabe si el gesto es vertical. */
    let tracking: boolean | null = null;
    let pull = 0;
    let armed = false;

    function reset() {
      scrollEl = null;
      tracking = null;
      pull = 0;
      armed = false;
    }

    function eligibleScrollArea(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      const area = target.closest<HTMLElement>(".scroll-area");
      if (!area) return null;
      if (target.closest("input, textarea, select, [contenteditable], [data-no-pull]")) {
        return null;
      }
      // Nada que esté en una capa fija encima de la pantalla.
      for (let el: Element | null = target; el && el !== area; el = el.parentElement) {
        if (getComputedStyle(el).position === "fixed") return null;
      }
      return area;
    }

    function onStart(e: TouchEvent) {
      reset();
      if (refreshingRef.current || e.touches.length !== 1) return;
      const area = eligibleScrollArea(e.target);
      if (!area || area.scrollTop > 0) return;
      scrollEl = area;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }

    function onMove(e: TouchEvent) {
      if (!scrollEl) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (tracking === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Horizontal (carrusel, swipe de fotos) o hacia arriba: no es esto.
        tracking = dy > 0 && Math.abs(dy) > Math.abs(dx);
        if (!tracking) {
          reset();
          return;
        }
        // Ubicar la franja justo debajo del encabezado de ESTA pantalla.
        // offsetTop sale en px del layout, así que no lo afecta el zoom
        // global de <html>.
        if (clipRef.current) clipRef.current.style.top = `${scrollEl.offsetTop}px`;
      }
      if (!tracking) return;
      // Si la lista ya se movió (scrolleó hacia abajo en el mismo gesto),
      // soltar.
      if (scrollEl.scrollTop > 0) {
        place(0, true);
        reset();
        return;
      }

      // Resistencia: cuanto más tira, menos avanza.
      pull = Math.min(MAX_PULL, dy * 0.55);
      place(pull, false);
      if (starRef.current) {
        starRef.current.style.transform = `rotate(${pull * 3}deg)`;
        starRef.current.style.opacity = String(0.35 + 0.65 * Math.min(1, pull / THRESHOLD));
      }
      const nowArmed = pull >= THRESHOLD;
      if (nowArmed !== armed) {
        armed = nowArmed;
        knobRef.current?.setAttribute("data-armed", armed ? "1" : "0");
        // Un toque corto al cruzar el umbral (Android; iPhone no vibra).
        if (armed) navigator.vibrate?.(8);
      }
    }

    function onEnd() {
      if (!scrollEl || !tracking) {
        reset();
        return;
      }
      if (armed) {
        refreshingRef.current = true;
        spinStartedAt.current = Date.now();
        setRefreshing(true);
        place(THRESHOLD * 0.8, true);
        startTransition(() => router.refresh());
      } else {
        place(0, true);
      }
      knobRef.current?.setAttribute("data-armed", "0");
      reset();
    }

    // Pasivos: el gesto nunca bloquea el scroll. No hace falta
    // preventDefault porque la lista ya está arriba del todo.
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  return (
    <>
    <div
      ref={clipRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-30 h-[130px] overflow-hidden"
      style={{ top: 0 }}
    >
      <div
        ref={knobRef}
        data-armed="0"
        className="cb-ptr-knob absolute left-1/2 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-[0_4px_14px_rgba(42,31,20,0.14)] ring-1 ring-black/[0.04]"
        style={{ transform: "translate(-50%, -48px)", opacity: 0 }}
      >
        <div className={refreshing ? "cb-ptr-spin" : undefined}>
          <div ref={starRef} className="cb-ptr-star">
            <BahaiStar size={24} />
          </div>
        </div>
      </div>
    </div>
    {/* Para lectores de pantalla: el gesto es visual, el resultado no. */}
    <span className="sr-only" role="status">
      {refreshing ? "Actualizando" : ""}
    </span>
    </>
  );
}
