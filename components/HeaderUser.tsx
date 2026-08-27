"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import { Avatar } from "./Avatar";
import { NotificationBell } from "./NotificationBell";

export type HeaderUser = {
  avatarUrl: string | null;
  fullName: string | null;
  unreadCount: number;
};

/**
 * El menú de perfil (campana + avatar) va en TODAS las pantallas de la app
 * del creyente, así que el dato lo pone el layout una sola vez y lo lee
 * `GoldHeader` (y el header propio del chat) por contexto. Sin esto, cada
 * página tendría que volver a consultar el perfil y las notificaciones
 * para pasarlo por props.
 */
const HeaderUserContext = createContext<HeaderUser | null>(null);

export function HeaderUserProvider({
  value,
  children,
}: {
  value: HeaderUser;
  children: React.ReactNode;
}) {
  return (
    <HeaderUserContext.Provider value={value}>
      {children}
    </HeaderUserContext.Provider>
  );
}

/**
 * Campana de notificaciones + avatar con link al perfil. Devuelve null
 * fuera del provider (p. ej. el modo demo del chat sin sesión), así que
 * los headers pueden renderizarlo sin preguntar.
 */
export function HeaderUserMenu({ className = "" }: { className?: string }) {
  const user = useContext(HeaderUserContext);
  if (!user) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`}>
      <NotificationBell unreadCount={user.unreadCount} />
      <Link href="/perfil" aria-label="Mi perfil" className="tap inline-flex">
        <Avatar url={user.avatarUrl} name={user.fullName} size={38} />
      </Link>
    </span>
  );
}
