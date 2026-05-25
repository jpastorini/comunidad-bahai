"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SegmentItem = {
  href: string;
  label: string;
  /** Match by prefix (para sub-rutas como /fiestas/[id]); default exacto. */
  prefix?: string;
};

/**
 * Control segmentado para los hubs (Biblioteca, Calendario). Cada segmento
 * es un Link a una ruta existente; el activo se resalta según el pathname.
 * Mantiene las URLs reales (SSR de cada página) en vez de estado en cliente.
 */
export function SegmentedNav({ items }: { items: SegmentItem[] }) {
  const pathname = usePathname();

  return (
    <div className="shrink-0 px-4 pb-2 pt-3">
      <nav
        className="flex gap-1 rounded-full bg-black/[0.04] p-1"
        aria-label="Secciones"
      >
        {items.map((item) => {
          const isActive = item.prefix
            ? pathname.startsWith(item.prefix)
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`tap flex min-w-0 flex-1 items-center justify-center rounded-full px-2 py-1.5 text-center text-[11.5px] tracking-[0.1px] transition-colors ${
                isActive
                  ? "bg-card font-semibold text-terra shadow-card-soft"
                  : "font-medium text-muted"
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

/** Items del hub Biblioteca (textos para leer). */
export const BIBLIOTECA_SEGMENTS: SegmentItem[] = [
  { href: "/mensajes", label: "Mensajes", prefix: "/mensajes" },
  { href: "/comunicados", label: "Comunicados", prefix: "/comunicados" },
  { href: "/materiales", label: "Materiales", prefix: "/materiales" },
];

/** Items del hub Calendario (todo lo que ocurre en el tiempo). */
export const CALENDARIO_SEGMENTS: SegmentItem[] = [
  { href: "/calendario", label: "Calendario", prefix: "/calendario" },
  { href: "/fiestas", label: "Fiestas", prefix: "/fiestas" },
  { href: "/dias-sagrados", label: "Días Sagrados", prefix: "/dias-sagrados" },
  { href: "/actividades", label: "Actividades", prefix: "/actividades" },
];
