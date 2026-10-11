"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Los pushes anteriores a la pantalla propia del comunicado abrían
 * `/comunicados#c-<id>` y una tarjeta en la lista los recibía. Ahora el
 * comunicado tiene su página: si la lista llega con ese hash, manda a
 * `/comunicados/<id>` (replace, para que "atrás" no vuelva al hash y lo
 * repita). El hash no viaja al servidor, por eso es un efecto en el
 * cliente. Los avisos nuevos ya apuntan a la página directo.
 */
export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#c-") || hash.length < 4) return;
    const id = decodeURIComponent(hash.slice(3));
    if (!/^[\w-]+$/.test(id)) return;
    router.replace(`/comunicados/${id}`);
  }, [router]);
  return null;
}
