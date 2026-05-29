import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconCalendario,
  IconChat,
  IconMensajes,
  IconOraciones,
} from "../Icons";

type SectionItem = {
  href: string;
  title: string;
  Icon: ComponentType<{ size?: number }>;
  color: string; // hex
  /** Cuando true muestra un punto rojo de aviso en la esquina. */
  hasUnseen?: boolean;
};

type Props = {
  /** Indicadores personales del usuario logueado. */
  badges?: {
    chat_has_unseen?: boolean;
    comunicados_has_unseen?: boolean;
  };
};

/**
 * Accesos rápidos en Inicio. No duplica el TabBar (que navega por hubs):
 * surfacea destinos de alta intención o que quedan a 2 toques dentro de
 * un hub (Chat y Comunicados viven en AEL; Fiestas vive en Calendario).
 */
export function SectionGrid({ badges }: Props) {
  const TERRA = "#2A3F8F";
  const AMBER = "#7E44B8";
  const GOLD = "#96790E";
  const GREEN = "#6A8B5F";

  const sections: SectionItem[] = [
    {
      href: "/chat",
      title: "Chat",
      Icon: IconChat,
      color: AMBER,
      hasUnseen: badges?.chat_has_unseen ?? false,
    },
    {
      href: "/oraciones",
      title: "Oraciones",
      Icon: IconOraciones,
      color: GOLD,
    },
    {
      href: "/comunicados",
      title: "Comunicados",
      Icon: IconMensajes,
      color: TERRA,
      hasUnseen: badges?.comunicados_has_unseen ?? false,
    },
    {
      href: "/fiestas",
      title: "Fiestas",
      Icon: IconCalendario,
      color: GREEN,
    },
  ];

  return (
    <div className="mb-4">
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-dark">
        Accesos rápidos
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {sections.map((s) => (
          <SectionCard key={s.href} {...s} />
        ))}
      </div>
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
          className="absolute right-1.5 top-1.5 h-[8px] w-[8px] rounded-full bg-rose-500 ring-2 ring-card"
        />
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
