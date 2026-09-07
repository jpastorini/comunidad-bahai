"use client";

import { useEffect } from "react";

/**
 * Lleva la vista a la tarjeta que nombra el hash de la URL
 * (`/comunicados#c-<id>`), que es adonde apunta el push de un
 * comunicado nuevo. La lista vive dentro de un contenedor con scroll
 * propio (`.scroll-area`), así que el salto nativo del navegador no
 * siempre llega; `scrollIntoView` sí. Se hace una sola vez al montar.
 */
export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    // Un frame después, para que el layout ya esté medido.
    const t = window.setTimeout(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
