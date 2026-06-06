"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
const BIBLIOTECA_ROUTES = ["/mensajes", "/materiales", "/oraciones"];
const CALENDARIO_ROUTES = ["/calendario", "/fiestas", "/dias-sagrados", "/actividades"];
// Hub AEL: todo lo directo de la Asamblea Espiritual Local.
const AEL_ROUTES = ["/comunicados", "/chat", "/tesoreria"];

const TABS: Tab[] = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/mensajes", label: "Biblioteca", Icon: IconBiblioteca },
  { href: "/calendario", label: "Calendario", Icon: IconCalendario },
  { href: "/servicio", label: "Servicio", Icon: IconServicio },
  { href: "/comunicados", label: "AEL", Icon: IconAEL },
];

export function TabBar({ aelHasUnseen = false }: { aelHasUnseen?: boolean }) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);

  return (
    <nav
      className="shrink-0 rounded-t-[20px] border-t border-black/[0.06] bg-card shadow-[0_-6px_20px_-10px_rgba(0,0,0,0.18)]"
      // Con viewport-fit=cover el shell (100dvh) se dibuja por detrás de la barra
      // de gestos de Android. En iOS env(safe-area-inset-bottom) la compensa, pero
      // Android suele reportarla en 0 aunque la barra exista, dejando las etiquetas
      // del menú ocultas detrás del gesto. El max() garantiza un piso de separación
      // aunque el inset venga en 0, sin dejar demasiado espacio en blanco.
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 18px, 30px)" }}
    >
      <ul className="flex items-center justify-around pt-2.5">
        {TABS.map((tab) => {
          const isActive = tab.href === activeHref;
          // Chat y Comunicados viven dentro del hub AEL, así que su aviso
          // se muestra en la pestaña AEL (href "/comunicados").
          const showUnseen = aelHasUnseen && tab.href === "/comunicados";
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className="tap relative flex flex-col items-center gap-1"
              >
                {/* Acento superior que marca dónde estás */}
                {isActive && (
                  <span className="absolute -top-[7px] left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-terra" />
                )}
                <span
                  className={`relative flex h-8 items-center justify-center rounded-full px-4 transition-colors ${
                    isActive ? "bg-terra/[0.12] text-terra" : "text-dark/45"
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
                  className={`text-[10.5px] tracking-[0.1px] ${
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
  if (BIBLIOTECA_ROUTES.some((r) => pathname.startsWith(r))) return "/mensajes";
  if (CALENDARIO_ROUTES.some((r) => pathname.startsWith(r))) return "/calendario";
  if (AEL_ROUTES.some((r) => pathname.startsWith(r))) return "/comunicados";
  if (pathname.startsWith("/servicio")) return "/servicio";
  return "/";
}
