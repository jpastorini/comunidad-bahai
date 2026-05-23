"use client";

import { useEffect } from "react";
import { markAllNotificationsReadAction } from "@/components/gallery/interaction-actions";

/**
 * Cliente que dispara una sola vez al montarse para marcar todas las
 * notificaciones del usuario como leídas. Se monta en /notificaciones,
 * después de que el server-rendered list ya se mostró.
 */
export function MarkAsReadOnMount() {
  useEffect(() => {
    void markAllNotificationsReadAction();
    // Sin deps: solo al montarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
