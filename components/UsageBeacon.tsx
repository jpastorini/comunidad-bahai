"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { sectionForPath } from "@/lib/usage-sections";

/**
 * Anota el uso de la app (049). No renderiza nada.
 *
 * Cada vez que cambia la sección (no la pantalla: moverse entre dos
 * libros de la Biblioteca es una sola visita a "Biblioteca") llama a
 * `record_usage()`, que suma uno a la fila del día de esa persona. Va
 * directo del navegador a Supabase, sin pasar por el servidor de la
 * app: es un dato de telemetría y no hace falta que espere a nadie.
 *
 * Cuando la PWA vuelve al frente se anota otra vez la sección actual:
 * en el celular esa es la forma habitual de "abrir la app".
 *
 * `standalone` le dice a la base si corre instalada; la base guarda la
 * primera vez que lo ve (`profiles.pwa_installed_at`).
 */
export function UsageBeacon() {
  const pathname = usePathname();
  const lastSection = useRef<string | null>(null);

  useEffect(() => {
    const section = sectionForPath(pathname);
    if (lastSection.current === section) return;
    lastSection.current = section;
    record(section);
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (lastSection.current) record(lastSection.current);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function record(section: string) {
  try {
    const supabase = createSupabaseBrowser();
    void supabase
      .rpc("record_usage", { p_section: section, p_standalone: isStandalone() })
      .then(({ error }) => {
        // Antes de la 049 la función no existe. No es un error de la
        // persona; se loguea y se sigue.
        if (error) console.warn("[usage]", error.message);
      });
  } catch {
    // Sin Supabase configurado (modo demo) no hay nada que anotar.
  }
}
