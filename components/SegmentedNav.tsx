"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useIsBahai, useIsNationalCommunity } from "./HeaderUser";

export type SegmentItem = {
  href: string;
  label: string;
  /** Match by prefix (para sub-rutas como /fiestas/[id]); default exacto. */
  prefix?: string;
  /** Solo para creyentes: un Amigo/a de la Fe no ve este segmento (047). */
  bahaiOnly?: boolean;
  /** Solo en una Asamblea Local: la Comunidad Nacional no lo tiene (056). */
  aelOnly?: boolean;
};

/**
 * Control segmentado para los hubs (Biblioteca, Calendario). Cada segmento
 * es un Link a una ruta existente; el activo se resalta según el pathname.
 * Mantiene las URLs reales (SSR de cada página) en vez de estado en cliente.
 */
export function SegmentedNav({ items }: { items: SegmentItem[] }) {
  const pathname = usePathname();
  const isBahai = useIsBahai();
  const isNational = useIsNationalCommunity();
  const visible = items.filter(
    (i) => (isBahai || !i.bahaiOnly) && !(isNational && i.aelOnly)
  );
  const groupKey = visible.map((i) => i.href).join("|");
  const activeIndex = visible.findIndex((item) =>
    item.prefix ? pathname.startsWith(item.prefix) : pathname === item.href
  );

  // La píldora blanca se desliza al segmento elegido. Cada pantalla del
  // hub monta SU PROPIO SegmentedNav, así que no hay un componente vivo que
  // anime de un segmento al otro: la pantalla nueva arranca con la píldora
  // donde la dejó la anterior (memoria del módulo, sobrevive a la
  // navegación del cliente) y en el cuadro siguiente la lleva a su lugar.
  // En la carga inicial la memoria está vacía y el primer render coincide
  // con el del servidor.
  const [shown, setShown] = useState(() => lastSegment.get(groupKey) ?? activeIndex);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    lastSegment.set(groupKey, activeIndex);
    if (shown === activeIndex) return;
    const id = requestAnimationFrame(() => {
      setAnimate(true);
      setShown(activeIndex);
    });
    return () => cancelAnimationFrame(id);
    // `shown` fuera a propósito: solo importa de dónde arrancó al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, activeIndex]);

  const n = visible.length;

  return (
    <div className="shrink-0 px-4 pb-2 pt-3">
      <nav
        className="relative flex gap-1 rounded-full bg-black/[0.04] p-1"
        aria-label="Secciones"
      >
        {shown >= 0 && n > 0 && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-card shadow-card-soft ${
              animate ? "cb-slide" : ""
            }`}
            style={{
              // Los segmentos son flex-1 con gap-1 (4 px) dentro de p-1:
              // el ancho de uno y el salto al siguiente salen del índice,
              // sin medir nada.
              width: `calc((100% - 8px - ${(n - 1) * 4}px) / ${n})`,
              transform: `translateX(calc(${shown} * (100% + 4px)))`,
            }}
          />
        )}
        {visible.map((item, index) => {
          const isActive = index === activeIndex;
          const lit = index === shown;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              // Sin mover la píldora al tocar: la pantalla nueva la hace
              // viajar desde acá, y si esta ya hubiera arrancado se vería
              // un salto hacia atrás al montar la otra.
              className={`tap relative flex min-w-0 flex-1 items-center justify-center rounded-full px-2 py-1.5 text-center text-[11.5px] tracking-[0.1px] transition-colors duration-[405ms] ${
                lit ? "font-semibold text-terra" : "font-medium text-muted"
              }`}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Último segmento iluminado por grupo (clave: los href del grupo). */
const lastSegment = new Map<string, number>();

/** Items del hub Biblioteca (textos para leer). Oraciones va primero: es
 *  lo que se abre todos los días, y antes solo se llegaba desde el Inicio. */
export const BIBLIOTECA_SEGMENTS: SegmentItem[] = [
  { href: "/oraciones", label: "Oraciones", prefix: "/oraciones" },
  { href: "/mensajes", label: "Mensajes", prefix: "/mensajes" },
  { href: "/materiales", label: "Materiales", prefix: "/materiales" },
];

/** Items del hub AEL — todo lo que emite/gestiona la Asamblea Espiritual Local. */
export const AEL_SEGMENTS: SegmentItem[] = [
  { href: "/comunicados", label: "Comunicados", prefix: "/comunicados" },
  { href: "/boletin-local", label: "Boletín", prefix: "/boletin-local" },
  { href: "/chat", label: "Chat", prefix: "/chat" },
  { href: "/tesoreria", label: "Tesorería", prefix: "/tesoreria", bahaiOnly: true },
];

/** Canales del chat: a la Secretaría se le escribe de todo, al tesorero se
 *  le avisa del aporte hecho por giro directo a la cuenta. */
export const CHAT_SEGMENTS: SegmentItem[] = [
  { href: "/chat", label: "Secretaría" },
  { href: "/chat/tesoreria", label: "Tesorería", prefix: "/chat/tesoreria", bahaiOnly: true },
];

/** Items del hub Calendario (todo lo que ocurre en el tiempo). */
export const CALENDARIO_SEGMENTS: SegmentItem[] = [
  { href: "/calendario", label: "Calendario", prefix: "/calendario" },
  {
    href: "/fiestas",
    label: "Fiestas",
    prefix: "/fiestas",
    bahaiOnly: true,
    aelOnly: true,
  },
  { href: "/dias-sagrados", label: "Días Sagrados", prefix: "/dias-sagrados" },
  { href: "/actividades", label: "Actividades", prefix: "/actividades" },
];
