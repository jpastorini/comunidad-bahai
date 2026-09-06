"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Foto con pinch-zoom propio para el lightbox de la galería.
 *
 * El zoom del navegador está bloqueado en toda la app (`userScalable:
 * false` en app/layout.tsx) porque en una PWA rompe el layout; pero la
 * gente pincha las fotos con los dedos por reflejo y esperaba que
 * funcionara. Este componente implementa el gesto a mano con Pointer
 * Events, que unifican dedos y mouse:
 *
 *   - Pinch o doble toque agrandan. En cuanto la escala pasa de 1, la
 *     foto salta a PANTALLA COMPLETA (modo "inmersivo"): agrandar dentro
 *     de la cajita de 45vh del lightbox no sirve para ver un detalle. Al
 *     volver a escala 1 (doble toque, o achicar con los dedos) vuelve a
 *     su lugar, con comentarios y reacciones a la vista.
 *   - Un dedo arrastra la foto cuando está agrandada; a escala 1, el
 *     arrastre horizontal es el swipe de siempre entre fotos.
 *   - En PC: doble clic y rueda para agrandar, arrastrar para mover.
 *
 * El estado del gesto vive en refs y se aplica al <img> directo por
 * style.transform, sin pasar por React en cada movimiento: 60 eventos por
 * segundo re-renderizando el lightbox entero (comentarios incluidos) se
 * siente pegajoso en un celular viejo. React solo se entera de dos cosas
 * discretas: si está inmersivo y si está agrandada (para esconder las
 * flechas).
 */

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 30;
const SWIPE_THRESHOLD = 50;
/** Debajo de esto, un pinch hacia adentro se considera "volver a 1". */
const RESET_BELOW = 1.05;

type Pt = { x: number; y: number };

export function ZoomableImage({
  src,
  alt,
  onPrev,
  onNext,
  onImmersiveChange,
  children,
}: {
  src: string;
  alt: string;
  onPrev?: () => void;
  onNext?: () => void;
  /** Avisa cuando la foto toma o suelta la pantalla completa. */
  onImmersiveChange?: (immersive: boolean) => void;
  /** Controles superpuestos (flechas) que se ven solo a escala 1. */
  children?: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Estado del gesto (no pasa por React).
  const scale = useRef(1);
  const tx = useRef(0);
  const ty = useRef(0);
  const pointers = useRef(new Map<number, Pt>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ p: Pt; tx: number; ty: number } | null>(null);
  const lastTap = useRef<{ t: number; p: Pt } | null>(null);
  const moved = useRef(false);

  const [immersive, setImmersive] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // ── Geometría ──────────────────────────────────────────────────
  /** Tamaño con que la foto se pinta a escala 1 (object-contain). */
  function containedSize(): { w: number; h: number; W: number; H: number } {
    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img) return { w: 0, h: 0, W: 0, H: 0 };
    const W = box.clientWidth;
    const H = box.clientHeight;
    const nw = img.naturalWidth || W;
    const nh = img.naturalHeight || H;
    const r = Math.min(W / nw, H / nh);
    return { w: nw * r, h: nh * r, W, H };
  }

  /** Mantiene la foto cubriendo la caja: sin bordes negros de más. */
  function clamp() {
    const { w, h, W, H } = containedSize();
    const s = scale.current;
    const maxX = Math.max(0, (w * s - W) / 2);
    const maxY = Math.max(0, (h * s - H) / 2);
    tx.current = Math.min(maxX, Math.max(-maxX, tx.current));
    ty.current = Math.min(maxY, Math.max(-maxY, ty.current));
  }

  function apply(animate = false) {
    const img = imgRef.current;
    if (!img) return;
    img.style.transition = animate ? "transform 220ms ease" : "none";
    img.style.transform = `translate(${tx.current}px, ${ty.current}px) scale(${scale.current})`;
    const z = scale.current > 1;
    setZoomed((prev) => (prev === z ? prev : z));
  }

  /** Punto del evento relativo al CENTRO de la caja (origen del transform). */
  function localPoint(e: { clientX: number; clientY: number }): Pt {
    const box = boxRef.current;
    if (!box) return { x: 0, y: 0 };
    const r = box.getBoundingClientRect();
    return {
      x: e.clientX - r.left - r.width / 2,
      y: e.clientY - r.top - r.height / 2,
    };
  }

  /** Cambia la escala manteniendo fijo el punto `focal` bajo el dedo. */
  function zoomTo(next: number, focal: Pt, animate = false) {
    const s0 = scale.current;
    const s1 = Math.min(MAX_SCALE, Math.max(1, next));
    if (s1 === s0) return;
    const k = s1 / s0;
    tx.current = focal.x - (focal.x - tx.current) * k;
    ty.current = focal.y - (focal.y - ty.current) * k;
    scale.current = s1;
    if (s1 > 1 && !immersive) enterImmersive();
    clamp();
    apply(animate);
  }

  function reset(animate = true) {
    scale.current = 1;
    tx.current = 0;
    ty.current = 0;
    apply(animate);
  }

  function enterImmersive() {
    setImmersive(true);
    onImmersiveChange?.(true);
  }

  function exitImmersive() {
    reset(false);
    setImmersive(false);
    onImmersiveChange?.(false);
  }

  // ── Gestos ─────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    // Los controles superpuestos (flechas, ✕) manejan su propio click.
    if ((e.target as HTMLElement).closest("button")) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Un pointerId que el navegador ya no reconoce; el gesto sigue igual.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: dist(a, b), scale: scale.current };
      dragStart.current = null;
      if (!immersive) enterImmersive();
    } else if (pointers.current.size === 1) {
      dragStart.current = {
        p: { x: e.clientX, y: e.clientY },
        tx: tx.current,
        ty: ty.current,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      if (Math.abs(d - pinchStart.current.dist) > 4) moved.current = true;
      const mid = localPoint({
        clientX: (a.x + b.x) / 2,
        clientY: (a.y + b.y) / 2,
      });
      zoomTo((d / pinchStart.current.dist) * pinchStart.current.scale, mid);
      return;
    }

    if (pointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.p.x;
      const dy = e.clientY - dragStart.current.p.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
      if (scale.current > 1) {
        tx.current = dragStart.current.tx + dx;
        ty.current = dragStart.current.ty + dy;
        clamp();
        apply();
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const wasPinch = pointers.current.size === 2;
    pointers.current.delete(e.pointerId);

    if (wasPinch) {
      pinchStart.current = null;
      // Soltó un dedo: el que queda pasa a arrastrar desde donde está.
      const rest = [...pointers.current.values()][0];
      if (rest) {
        dragStart.current = { p: rest, tx: tx.current, ty: ty.current };
      }
      if (scale.current < RESET_BELOW) exitImmersive();
      return;
    }

    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;

    const dx = e.clientX - start.p.x;
    const dy = e.clientY - start.p.y;

    // A escala 1, un arrastre horizontal es el swipe entre fotos.
    if (scale.current === 1 && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) onPrev?.();
      else onNext?.();
      lastTap.current = null;
      return;
    }

    if (moved.current) return;

    // Toque sin movimiento: ¿es el segundo de un doble toque?
    const now = Date.now();
    const p = { x: e.clientX, y: e.clientY };
    const prev = lastTap.current;
    if (prev && now - prev.t < DOUBLE_TAP_MS && dist(prev.p, p) < DOUBLE_TAP_DIST) {
      lastTap.current = null;
      if (scale.current > 1) exitImmersive();
      else zoomTo(DOUBLE_TAP_SCALE, localPoint(e), true);
      return;
    }
    lastTap.current = { t: now, p };
  }

  function onPointerCancel(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    pinchStart.current = null;
    dragStart.current = null;
    if (pointers.current.size === 0 && scale.current < RESET_BELOW && immersive) {
      exitImmersive();
    }
  }

  function onWheel(e: React.WheelEvent) {
    // Rueda del mouse (PC): zoom alrededor del cursor.
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const next = scale.current * factor;
    if (next < RESET_BELOW) {
      if (immersive) exitImmersive();
      return;
    }
    zoomTo(next, localPoint(e));
  }

  // Que el navegador no meta su propio gesto (scroll, zoom de página).
  // touch-action:none cubre Android; iOS Safari además necesita frenar
  // `gesturestart` y el touchmove no pasivo.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const stop = (ev: Event) => ev.preventDefault();
    box.addEventListener("gesturestart", stop);
    box.addEventListener("touchmove", stop, { passive: false });
    return () => {
      box.removeEventListener("gesturestart", stop);
      box.removeEventListener("touchmove", stop);
    };
  }, []);

  // Cambio de foto: arranca en 1 y en su lugar.
  useEffect(() => {
    scale.current = 1;
    tx.current = 0;
    ty.current = 0;
    apply(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Tecla Escape en inmersivo vuelve al lightbox normal.
  useEffect(() => {
    if (!immersive) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        exitImmersive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive]);

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      className={
        immersive
          ? "fixed inset-0 z-[60] overflow-hidden bg-black"
          : "relative h-full w-full overflow-hidden"
      }
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="h-full w-full select-none object-contain will-change-transform"
        draggable={false}
        onLoad={() => apply(false)}
      />

      {!zoomed && children}

      {immersive ? (
        <>
          <button
            type="button"
            onClick={exitImmersive}
            aria-label="Volver"
            className="absolute right-3 z-10 rounded-full bg-white/15 px-3 py-1.5 text-[16px] text-white backdrop-blur-sm hover:bg-white/30"
            style={{ top: "calc(var(--safe-top) + 12px)" }}
          >
            ✕
          </button>
          {!zoomed && (
            <p
              className="pointer-events-none absolute inset-x-0 text-center text-[12px] text-white/70"
              style={{ bottom: "calc(var(--safe-bottom) + 16px)" }}
            >
              Pinchá o tocá dos veces para agrandar
            </p>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={enterImmersive}
          aria-label="Pantalla completa"
          className="absolute bottom-2 right-2 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm hover:bg-white/30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
