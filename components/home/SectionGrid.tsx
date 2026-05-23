import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconActividades,
  IconCalendario,
  IconChat,
  IconMateriales,
  IconMensajes,
  IconServicio,
  IconTesoreria,
} from "../Icons";

type SectionItem = {
  href: string;
  title: string;
  subtitle: string;
  Icon: ComponentType<{ size?: number }>;
  color: string; // hex (terra or amber)
  /** Cuando true muestra un punto rojo "!" en la esquina superior derecha. */
  hasUnseen?: boolean;
  progress?: number; // 0..1
};

type Props = {
  /** Indicadores personales del usuario logueado. */
  badges?: {
    chat_has_unseen?: boolean;
  };
};

export function SectionGrid({ badges }: Props) {
  const TERRA = "#2A3F8F";
  const AMBER = "#7E44B8";

  const sections: SectionItem[] = [
    { href: "/mensajes", title: "Mensajes", subtitle: "Casa Universal", Icon: IconMensajes, color: TERRA },
    {
      href: "/chat",
      title: "Chat con Secretaría",
      subtitle: "Asamblea Local",
      Icon: IconChat,
      color: AMBER,
      hasUnseen: badges?.chat_has_unseen ?? false,
    },
    { href: "/actividades", title: "Actividades", subtitle: "Locales", Icon: IconActividades, color: TERRA },
    { href: "/calendario", title: "Calendario", subtitle: "Mayo 2026", Icon: IconCalendario, color: AMBER },
    { href: "/servicio", title: "Servicio", subtitle: "Necesidades", Icon: IconServicio, color: TERRA },
    { href: "/materiales", title: "Materiales", subtitle: "de Estudio", Icon: IconMateriales, color: AMBER },
    { href: "/comunicados", title: "Comunicados", subtitle: "Asamblea Local", Icon: IconMensajes, color: TERRA },
    { href: "/fiestas", title: "Fiestas", subtitle: "19 Días", Icon: IconCalendario, color: AMBER },
    { href: "/tesoreria", title: "Tesorería", subtitle: "65% meta", Icon: IconTesoreria, color: AMBER, progress: 0.65 },
  ];

  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {sections.map((s) => (
        <SectionCard key={s.href} {...s} />
      ))}
    </div>
  );
}

function SectionCard({
  href,
  title,
  subtitle,
  Icon,
  color,
  hasUnseen,
  progress,
}: SectionItem) {
  return (
    <Link
      href={href}
      className="tap relative flex flex-col items-center gap-1.5 rounded-[14px] bg-card px-1.5 pb-2.5 pt-3 shadow-card"
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
        className="flex h-[36px] w-[36px] items-center justify-center rounded-[11px]"
        style={{ background: `${color}10`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold leading-[1.15] text-dark">
          {title}
        </div>
        <div className="mt-0.5 font-body text-[9px] leading-tight text-muted">
          {subtitle}
        </div>
      </div>
      {progress !== undefined && (
        <div
          className="mt-[-1px] h-[3px] w-[70%] overflow-hidden rounded-sm"
          style={{ background: "#7E44B820" }}
        >
          <div
            className="h-full rounded-sm"
            style={{ width: `${progress * 100}%`, background: "#7E44B8" }}
          />
        </div>
      )}
    </Link>
  );
}
