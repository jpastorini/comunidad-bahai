import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconAEL,
  IconBiblioteca,
  IconCalendario,
  IconServicio,
} from "../Icons";

type SectionItem = {
  href: string;
  title: string;
  Icon: ComponentType<{ size?: number }>;
  color: string; // hex
  /** Cuando true muestra un punto rojo "!" en la esquina superior derecha. */
  hasUnseen?: boolean;
};

type Props = {
  /** Indicadores personales del usuario logueado. */
  badges?: {
    chat_has_unseen?: boolean;
  };
};

/**
 * Lanzador de hubs en Inicio. Refleja la navegación por hubs:
 *   • Biblioteca → Mensajes · Materiales
 *   • Calendario → Calendario · Fiestas · Días Sagrados · Actividades
 *   • AEL        → Comunicados · Chat · Tesorería (lo directo de la Asamblea)
 *   • Servicio   → Necesidades y voluntariado
 */
export function SectionGrid({ badges }: Props) {
  const TERRA = "#2A3F8F";
  const AMBER = "#7E44B8";
  const GOLD = "#96790E";
  const GREEN = "#6A8B5F";

  const sections: SectionItem[] = [
    {
      href: "/mensajes",
      title: "Biblioteca",
      Icon: IconBiblioteca,
      color: TERRA,
    },
    {
      href: "/calendario",
      title: "Calendario",
      Icon: IconCalendario,
      color: AMBER,
    },
    {
      href: "/comunicados",
      title: "AEL",
      Icon: IconAEL,
      color: GOLD,
      // Surface el aviso del chat aquí, ya que vive dentro de AEL.
      hasUnseen: badges?.chat_has_unseen ?? false,
    },
    {
      href: "/servicio",
      title: "Servicio",
      Icon: IconServicio,
      color: GREEN,
    },
  ];

  return (
    <div className="mb-3 grid grid-cols-4 gap-2">
      {sections.map((s) => (
        <SectionCard key={s.href} {...s} />
      ))}
    </div>
  );
}

function SectionCard({ href, title, Icon, color, hasUnseen }: SectionItem) {
  return (
    <Link
      href={href}
      className="tap relative flex flex-col items-center gap-1.5 rounded-2xl bg-card px-1 pb-2.5 pt-3 shadow-card"
    >
      {hasUnseen && (
        <span
          aria-label="Hay novedades"
          className="absolute right-1.5 top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow"
        >
          !
        </span>
      )}
      <div
        className="flex h-[40px] w-[40px] items-center justify-center rounded-[13px]"
        style={{ background: `${color}12`, color }}
      >
        <Icon size={21} />
      </div>
      <div className="text-center text-[11px] font-semibold leading-tight text-dark">
        {title}
      </div>
    </Link>
  );
}
