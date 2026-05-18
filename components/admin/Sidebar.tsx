"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconActividades,
  IconCalendario,
  IconChat,
  IconMateriales,
  IconMensajes,
  IconServicio,
  IconTesoreria,
} from "@/components/Icons";
import { BahaiStar } from "@/components/BahaiStar";
import type { Profile } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof IconMensajes;
  requires?: "chat" | "treasury";
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Inicio", Icon: IconActividades },
  { href: "/admin/mensajes", label: "Mensajes (Casa Universal)", Icon: IconMensajes },
  { href: "/admin/comunicados", label: "Comunicados (Asamblea Local)", Icon: IconMensajes },
  { href: "/admin/actividades", label: "Actividades", Icon: IconActividades },
  { href: "/admin/calendario", label: "Calendario", Icon: IconCalendario },
  { href: "/admin/materiales", label: "Materiales", Icon: IconMateriales },
  { href: "/admin/servicio", label: "Servicio", Icon: IconServicio },
  { href: "/admin/chat", label: "Chat Secretaría", Icon: IconChat, requires: "chat" },
  { href: "/admin/tesoreria", label: "Tesorería", Icon: IconTesoreria, requires: "treasury" },
  { href: "/admin/miembros", label: "Miembros", Icon: IconActividades },
];

type Props = {
  profile: Profile;
  onNavigate?: () => void;
};

export function SidebarContent({ profile, onNavigate }: Props) {
  const pathname = usePathname();

  const items = NAV.filter((item) => {
    if (item.requires === "chat") return profile.can_respond_chat;
    if (item.requires === "treasury") return profile.can_manage_treasury;
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Logo block */}
      <div className="relative overflow-hidden bg-gold-grad px-5 pb-6 pt-7">
        <div className="pointer-events-none absolute right-[-10px] top-2 opacity-[0.10]">
          <BahaiStar size={90} color="#fff" />
        </div>
        <div className="relative">
          <div className="text-[9px] font-semibold uppercase tracking-[2.5px] text-white/55">
            Panel administrativo
          </div>
          <div className="mt-1 font-display text-[22px] font-bold leading-tight text-white">
            Comunidad Bahá'í
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                    active
                      ? "bg-terra text-white shadow-card-soft"
                      : "text-dark hover:bg-bg"
                  }`}
                >
                  <item.Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User card */}
      <div className="border-t border-black/[0.06] px-4 py-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Sesión activa
        </div>
        <div className="text-[13px] font-semibold text-dark">
          {profile.full_name || "Sin nombre"}
        </div>
        <div className="truncate text-[11px] text-muted">{profile.email}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded bg-terra/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terra">
            {profile.role}
          </span>
          {profile.can_respond_chat && (
            <span className="rounded bg-amber/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber">
              Chat
            </span>
          )}
          {profile.can_manage_treasury && (
            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
              Tesorería
            </span>
          )}
        </div>
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg border border-black/10 px-3 py-1.5 text-[12px] font-medium text-dark hover:bg-bg"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
