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
  badge?: string | number;
  progress?: number; // 0..1
};

type Props = {
  badges: {
    mensajes?: string | number;
    chat?: number;
    actividades?: number;
    servicio?: number;
  };
};

export function SectionGrid({ badges }: Props) {
  const TERRA = "#2A3F8F";
  const AMBER = "#7E44B8";

  const sections: SectionItem[] = [
    { href: "/mensajes", title: "Mensajes", subtitle: "Casa Universal", Icon: IconMensajes, color: TERRA, badge: badges.mensajes ?? "Nuevo" },
    { href: "/chat", title: "Chat con Secretaría", subtitle: "Asamblea Local", Icon: IconChat, color: AMBER, badge: badges.chat ?? 2 },
    { href: "/actividades", title: "Actividades", subtitle: "Locales", Icon: IconActividades, color: TERRA, badge: badges.actividades ?? 3 },
    { href: "/calendario", title: "Calendario", subtitle: "Mayo 2026", Icon: IconCalendario, color: AMBER },
    { href: "/servicio", title: "Servicio", subtitle: "Necesidades", Icon: IconServicio, color: TERRA, badge: badges.servicio ?? 5 },
    { href: "/materiales", title: "Materiales", subtitle: "de Estudio", Icon: IconMateriales, color: AMBER },
    { href: "/comunicados", title: "Comunicados", subtitle: "Asamblea Local", Icon: IconMensajes, color: TERRA },
    { href: "/fiestas", title: "Fiestas", subtitle: "19 Días", Icon: IconCalendario, color: AMBER },
    { href: "/tesoreria", title: "Tesorería", subtitle: "65% meta", Icon: IconTesoreria, color: AMBER, progress: 0.65 },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 gap-[9px]">
      {sections.map((s) => (
        <SectionCard key={s.href} {...s} />
      ))}
    </div>
  );
}

function SectionCard({ href, title, subtitle, Icon, color, badge, progress }: SectionItem) {
  const isNuevo = badge === "Nuevo";
  return (
    <Link
      href={href}
      className="tap relative flex flex-col items-center gap-[7px] rounded-[14px] bg-card px-2.5 pb-3 pt-3.5 shadow-card"
    >
      {badge !== undefined && (
        <span
          className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.3px]"
          style={{
            background: isNuevo ? "#2A3F8F" : "#2A3F8F15",
            color: isNuevo ? "#fff" : "#2A3F8F",
          }}
        >
          {badge}
        </span>
      )}
      <div
        className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px]"
        style={{ background: `${color}10`, color }}
      >
        <Icon size={20} />
      </div>
      <div className="text-center">
        <div className="text-[12.5px] font-semibold leading-[1.2] text-dark">
          {title}
        </div>
        <div className="mt-0.5 font-body text-[10px] text-muted">{subtitle}</div>
      </div>
      {progress !== undefined && (
        <div
          className="mt-[-2px] h-1 w-[75%] overflow-hidden rounded-sm"
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
