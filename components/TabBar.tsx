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
  /** Match prefix instead of exact path; useful for nested screens. */
  prefix?: string;
  Icon: typeof IconHome;
};

// Rutas que iluminan cada hub. El primer href es el destino por defecto.
const BIBLIOTECA_ROUTES = ["/mensajes", "/materiales"];
const CALENDARIO_ROUTES = ["/calendario", "/fiestas", "/dias-sagrados", "/actividades"];
// Hub AEL: todo lo directo de la Asamblea Espiritual Local.
const AEL_ROUTES = ["/comunicados", "/chat", "/tesoreria"];

const TABS: Tab[] = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/mensajes", label: "Biblioteca", Icon: IconBiblioteca, prefix: "/mensajes" },
  { href: "/calendario", label: "Calendario", Icon: IconCalendario, prefix: "/calendario" },
  { href: "/servicio", label: "Servicio", Icon: IconServicio, prefix: "/servicio" },
  { href: "/comunicados", label: "AEL", Icon: IconAEL, prefix: "/comunicados" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-black/[0.06] bg-card"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
    >
      <ul className="flex items-center justify-around pt-2.5">
        {TABS.map((tab) => {
          const isActive = isTabActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`tap flex flex-col items-center gap-[3px] ${
                  isActive ? "text-terra" : "text-muted"
                }`}
              >
                <tab.Icon size={20} />
                <span
                  className={`text-[10px] tracking-[0.1px] ${
                    isActive ? "font-semibold" : "font-normal"
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

function isTabActive(tab: Tab, pathname: string): boolean {
  if (tab.href === "/") return pathname === "/";
  if (tab.href === "/comunicados")
    return AEL_ROUTES.some((r) => pathname.startsWith(r));
  if (tab.href === "/mensajes")
    return BIBLIOTECA_ROUTES.some((r) => pathname.startsWith(r));
  if (tab.href === "/calendario")
    return CALENDARIO_ROUTES.some((r) => pathname.startsWith(r));
  return tab.prefix ? pathname.startsWith(tab.prefix) : pathname === tab.href;
}
