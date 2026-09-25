"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";
import {
  IconAEL,
  IconBiblioteca,
  IconCalendario,
  IconHome,
  IconServicio,
} from "./Icons";

type Tab = {
  href: string;
  label: string;
  Icon: typeof IconHome;
};

// Rutas que iluminan cada hub. El primer href es el destino por defecto.
// Oraciones es contenido de Biblioteca; las pantallas personales sueltas
// (perfil, notificaciones, fotos, boletín) caen en Inicio como fallback.
// /citas (los Escritos de la Lectura de hoy) también es Biblioteca: se
// llega desde Materiales y desde la tarjeta del Inicio.
const BIBLIOTECA_ROUTES = ["/oraciones", "/mensajes", "/materiales", "/buscar", "/citas"];
const CALENDARIO_ROUTES = ["/calendario", "/fiestas", "/dias-sagrados", "/actividades"];
// Hub AEL: todo lo directo de la Asamblea Espiritual Local.
const AEL_ROUTES = ["/comunicados", "/boletin-local", "/chat", "/tesoreria"];

const TABS: Tab[] = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/oraciones", label: "Biblioteca", Icon: IconBiblioteca },
  { href: "/calendario", label: "Calendario", Icon: IconCalendario },
  { href: "/servicio", label: "Servicio", Icon: IconServicio },
  { href: "/comunicados", label: "Institucional", Icon: IconAEL },
];

export function TabBar({ aelHasUnseen = false }: { aelHasUnseen?: boolean }) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);
  // La pestaña recién tocada se ilumina AL TOCAR, no cuando la pantalla
  // nueva terminó de llegar: si la red tarda, la marca ya dice "voy para
  // allá" en vez de quedarse en la anterior como si el toque no hubiera
  // entrado. Se descarta en cuanto cambia la ruta.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => setPendingHref(null), [pathname]);
  const shownHref = pendingHref ?? activeHref;

  // Una sola marca (barrita de arriba + píldora detrás del ícono) que se
  // desliza a la pestaña iluminada. Se mide con offsetLeft/offsetWidth, que
  // son px del layout como el translate: con getBoundingClientRect el zoom
  // global de <html> (lib/ui-zoom.ts) la correría de lugar en "Grande".
  const ulRef = useRef<HTMLUListElement>(null);
  const pillRefs = useRef(new Map<string, HTMLSpanElement>());
  const [mark, setMark] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Sin transición la primera vez: la marca aparece en su lugar, no
  // viajando desde la izquierda.
  const [animate, setAnimate] = useState(false);

  useIsoLayoutEffect(() => {
    function measure() {
      const pill = pillRefs.current.get(shownHref);
      const link = pill?.parentElement;
      if (!pill || !link) return;
      setMark({
        x: link.offsetLeft + pill.offsetLeft,
        y: link.offsetTop + pill.offsetTop,
        w: pill.offsetWidth,
        h: pill.offsetHeight,
      });
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (ulRef.current) ro.observe(ulRef.current);
    return () => ro.disconnect();
  }, [shownHref]);

  useEffect(() => {
    if (!mark || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [mark, animate]);

  return (
    <nav
      className="shrink-0 rounded-t-[20px] border-t border-black/[0.06] bg-card shadow-[0_-6px_20px_-10px_rgba(0,0,0,0.18)]"
      // Con viewport-fit=cover el shell (100dvh) se dibuja por detrás de la barra
      // de gestos de Android. En iOS env(safe-area-inset-bottom) la compensa, pero
      // Android suele reportarla en 0 aunque la barra exista, dejando las etiquetas
      // del menú ocultas detrás del gesto. El max() garantiza un piso de separación
      // aunque el inset venga en 0, sin dejar demasiado espacio en blanco.
      // containerType: las etiquetas se miden contra el ancho de la barra (cqw).
      style={{
        paddingBottom: "max(var(--safe-bottom) + 18px, 22px)",
        containerType: "inline-size",
      }}
    >
      <ul ref={ulRef} className="relative flex items-center justify-around pt-2.5">
        {mark && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-0 top-0 rounded-full bg-terra/[0.12] ${
              animate ? "cb-slide" : ""
            }`}
            style={{
              width: mark.w,
              height: mark.h,
              transform: `translate(${mark.x}px, ${mark.y}px)`,
            }}
          >
            {/* Acento superior que marca dónde estás */}
            <span className="absolute -top-[7px] left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-terra" />
          </span>
        )}
        {TABS.map((tab) => {
          const isActive = tab.href === shownHref;
          // Chat y Comunicados viven dentro del hub AEL, así que su aviso
          // se muestra en la pestaña AEL (href "/comunicados").
          const showUnseen = aelHasUnseen && tab.href === "/comunicados";
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                // Prefetch COMPLETO, no el de por defecto. Como las rutas
                // son dinámicas, el prefetch "auto" solo trae el esqueleto
                // de loading.tsx y los datos igual se piden al tocar; con
                // prefetch={true} la pantalla entera queda en memoria y el
                // cambio de pestaña es instantáneo. Se paga con 5 renders
                // en segundo plano al abrir, que no bloquean nada y no se
                // repiten mientras la entrada siga fresca (staleTimes en
                // next.config.mjs).
                prefetch
                aria-current={tab.href === activeHref ? "page" : undefined}
                onClick={(e) => {
                  // Abrir en otra pestaña (ctrl/cmd) no navega acá.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  if (tab.href !== activeHref) setPendingHref(tab.href);
                }}
                className="tap relative flex flex-col items-center gap-1"
              >
                <span
                  ref={(el) => {
                    if (el) pillRefs.current.set(tab.href, el);
                    else pillRefs.current.delete(tab.href);
                  }}
                  // El relleno de la píldora NO crece con la letra: a zoom 1,3 en un
                  // celular de 375 px el shell mide 288 px y con px-4 las cinco
                  // pestañas pedían 295 ("Institucional" se cortaba). Dividido
                  // por el zoom, mide lo mismo en pantalla en los tres tamaños.
                  style={{ paddingInline: "calc(16px / var(--ui-zoom, 1))" }}
                  className={`relative flex h-8 items-center justify-center rounded-full transition-colors duration-[405ms] ${
                    isActive ? "text-terra" : "text-dark/45"
                  }`}
                >
                  {showUnseen && (
                    <span
                      aria-label="Hay novedades en el chat"
                      className="absolute right-1.5 top-0.5 h-[7px] w-[7px] rounded-full bg-rose-500 ring-2 ring-card"
                    />
                  )}
                  <tab.Icon size={isActive ? 24 : 22} />
                </span>
                <span
                  // Con letra grande las cinco etiquetas no entran: juntas piden unos
                  // 25 px de ancho por px de letra, más los huecos. Hasta donde
                  // entran van a 10,5 px (que el zoom agranda como a todo); en un
                  // celular angosto con "Muy grande" se achican lo justo para
                  // entrar; en pantalla quedan como con la letra normal o más
                  // grandes (el peor caso, 320 px a 1,3, sale a 10,2 px).
                  style={{ fontSize: "min(10.5px, calc((100cqw - 48px) / 25))" }}
                  className={`whitespace-nowrap tracking-[0.1px] ${
                    isActive
                      ? "font-semibold text-terra"
                      : "font-medium text-dark/55"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Resuelve qué pestaña iluminar para una ruta. Devuelve siempre un href:
 * si la ruta no pertenece a ningún hub, cae en Inicio, de modo que la barra
 * nunca queda apagada y siempre indica dónde estás.
 */
function resolveActiveHref(pathname: string): string {
  if (BIBLIOTECA_ROUTES.some((r) => pathname.startsWith(r))) return "/oraciones";
  if (CALENDARIO_ROUTES.some((r) => pathname.startsWith(r))) return "/calendario";
  if (AEL_ROUTES.some((r) => pathname.startsWith(r))) return "/comunicados";
  if (pathname.startsWith("/servicio")) return "/servicio";
  return "/";
}
