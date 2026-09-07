"use client";

import { useEffect } from "react";
import { touchLastSeenAction } from "@/app/(app)/comunicados/actions";

/**
 * Anota "última vez en la app" (048). No renderiza nada.
 *
 * Corre al montar el shell de (app) —una vez por carga, porque el layout
 * sobrevive a las navegaciones— y cada vez que la PWA vuelve al frente
 * (visibilitychange), que en el celular es la forma habitual de "abrir
 * la app". El servidor frena con una cookie diaria, así que llamar de
 * más no escribe de más.
 */
export function PresenceBeacon() {
  useEffect(() => {
    const touch = () => {
      if (document.visibilityState !== "visible") return;
      void touchLastSeenAction().catch(() => {});
    };
    touch();
    document.addEventListener("visibilitychange", touch);
    return () => document.removeEventListener("visibilitychange", touch);
  }, []);
  return null;
}
