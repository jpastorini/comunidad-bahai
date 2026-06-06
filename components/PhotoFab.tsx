"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Superficies de navegación donde ofrecer "subir foto". Se evita en
// pantallas de lectura (chat, oraciones, tesorería…) para no estorbar.
const SHOW_ON_PREFIXES = [
  "/calendario",
  "/fiestas",
  "/dias-sagrados",
  "/boletin",
];

function shouldShow(pathname: string): boolean {
  if (pathname === "/fotos/subir") return false;
  if (pathname === "/") return true;
  return SHOW_ON_PREFIXES.some((p) => pathname.startsWith(p));
}

export function PhotoFab() {
  const pathname = usePathname();
  if (!shouldShow(pathname)) return null;

  return (
    <Link
      href="/fotos/subir"
      aria-label="Compartir fotos"
      className="tap absolute right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-terra text-white shadow-lg shadow-terra/30 active:scale-95"
      // Debe quedar por encima del TabBar, que ahora reserva un piso de 46px para
      // la barra de gestos de Android (ver TabBar.tsx). Mismo max() para acompañarlo.
      style={{ bottom: "max(env(safe-area-inset-bottom, 0px) + 84px, 92px)" }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </Link>
  );
}
