"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Fecha civil (YYYY-MM-DD) con la que el servidor armó esta pantalla. */
  renderedDate: string;
  /** Huso de la comunidad. El cliente compara con el MISMO huso que el
   *  servidor: si comparara con el del dispositivo, alguien de viaje
   *  entraría en un ciclo de refresco permanente. */
  timeZone: string;
};

/**
 * Refresca la pantalla cuando cambió el día.
 *
 * La app es una PWA instalada: el sistema la suspende en vez de cerrarla,
 * así que al volver a abrirla al otro día se ve el árbol de React que
 * quedó renderizado ayer — con la Lectura de hoy de ayer, los "próximos
 * eventos" de ayer, etc. Ni el service worker ni el router lo notan,
 * porque para ellos no hubo navegación.
 *
 * Al volver del segundo plano comparamos la fecha con la que se renderizó
 * la pantalla y, si cambió, pedimos datos frescos.
 */
export function DayChangeRefresh({ renderedDate, timeZone }: Props) {
  const router = useRouter();
  const lastRefreshedFor = useRef<string | null>(null);

  useEffect(() => {
    function currentDate(): string {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch {
        // Huso inválido: mejor no hacer nada que refrescar en loop.
        return renderedDate;
      }
    }

    function checkDay() {
      if (document.visibilityState !== "visible") return;
      const today = currentDate();
      if (today === renderedDate) return;
      // Una sola vez por fecha: si el servidor siguiera devolviendo lo
      // viejo, no queremos un ciclo de refrescos.
      if (lastRefreshedFor.current === today) return;
      lastRefreshedFor.current = today;
      router.refresh();
    }

    checkDay();
    document.addEventListener("visibilitychange", checkDay);
    window.addEventListener("focus", checkDay);
    return () => {
      document.removeEventListener("visibilitychange", checkDay);
      window.removeEventListener("focus", checkDay);
    };
  }, [renderedDate, timeZone, router]);

  return null;
}
