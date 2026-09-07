"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IconAEL,
  IconCalendario,
  IconChevronDown,
  IconHome,
  IconMensajes,
  IconNacional,
  IconPersonas,
  IconTesoreria,
} from "@/components/Icons";
import { BahaiStar } from "@/components/BahaiStar";
import { activeLeaf, visibleNav, type NavGroup } from "@/lib/admin-nav";
import { ROLE_LABELS, type Locality, type Profile } from "@/lib/types";

/** Un ícono por grupo (no por pantalla): siete distintos, sin repetir. */
const GROUP_ICONS: Record<string, typeof IconMensajes> = {
  inicio: IconHome,
  asamblea: IconAEL,
  comunicacion: IconMensajes,
  comunidad: IconCalendario,
  creyentes: IconPersonas,
  tesoreria: IconTesoreria,
  nacional: IconNacional,
};

/** Grupos que la persona dejó abiertos, por dispositivo. */
const OPEN_KEY = "cb-admin-nav-open";

function readOpen(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function writeOpen(keys: string[]) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(keys));
  } catch {
    /* modo privado o storage bloqueado: se pierde la memoria, nada más */
  }
}

type Props = {
  profile: Profile;
  locality?: Locality;
  onNavigate?: () => void;
};

export function SidebarContent({ profile, locality, onNavigate }: Props) {
  const pathname = usePathname();
  const groups = useMemo(() => visibleNav(profile), [profile]);
  const active = useMemo(() => activeLeaf(groups, pathname), [groups, pathname]);
  const activeGroupKey = active?.group.key ?? null;

  // Arranca con SOLO el grupo de la pantalla actual abierto (es lo que el
  // servidor puede saber); los que la persona dejó abiertos se suman al
  // montar, cuando hay localStorage.
  const [open, setOpen] = useState<string[]>(activeGroupKey ? [activeGroupKey] : []);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpen((prev) => Array.from(new Set([...prev, ...readOpen()])));
    setHydrated(true);
  }, []);

  // Regla 1: la categoría de la pantalla actual está siempre abierta. Se
  // puede cerrar a mano, pero al navegar a otra pantalla suya vuelve a abrir.
  useEffect(() => {
    if (!activeGroupKey) return;
    setOpen((prev) => (prev.includes(activeGroupKey) ? prev : [...prev, activeGroupKey]));
  }, [activeGroupKey, pathname]);

  useEffect(() => {
    if (hydrated) writeOpen(open);
  }, [open, hydrated]);

  const toggle = (key: string) =>
    setOpen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <div className="flex h-full flex-col">
      {/* Logo block — muestra la localidad activa */}
      <div className="relative overflow-hidden bg-gold-grad px-5 pb-6 pt-7">
        <div className="pointer-events-none absolute right-[-10px] top-2 opacity-[0.10]">
          <BahaiStar size={90} color="#fff" />
        </div>
        <div className="relative">
          <div className="text-[9px] font-semibold uppercase tracking-[2.5px] text-white/55">
            Panel de la Asamblea
          </div>
          <div className="mt-1 font-display text-[20px] font-bold leading-tight text-white">
            {locality?.name ?? "Comunidad Bahá'í"}
          </div>
          {locality?.city && (
            <div className="mt-0.5 text-[10.5px] text-white/65">
              {locality.city} · {locality.country}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {groups.map((group) => (
            <GroupRow
              key={group.key}
              group={group}
              Icon={GROUP_ICONS[group.key] ?? IconMensajes}
              isOpen={open.includes(group.key)}
              isActiveGroup={group.key === activeGroupKey}
              activeHref={active?.leaf?.href ?? null}
              onToggle={() => toggle(group.key)}
              onNavigate={onNavigate}
            />
          ))}
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
          {profile.is_national_admin && (
            <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
              Nacional
            </span>
          )}
          <span className="rounded bg-terra/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terra">
            {ROLE_LABELS[profile.role]}
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
          {profile.can_manage_bulletin && (
            <span className="rounded bg-terra/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terra">
              Boletín
            </span>
          )}
        </div>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-terra/[0.06] px-3 py-1.5 text-[12px] font-semibold text-terra hover:bg-terra/10"
        >
          ← Volver a la app de comunidad
        </Link>
        <form action="/auth/signout" method="post" className="mt-2">
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

function GroupRow({
  group,
  Icon,
  isOpen,
  isActiveGroup,
  activeHref,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  Icon: typeof IconMensajes;
  isOpen: boolean;
  isActiveGroup: boolean;
  activeHref: string | null;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const gold = group.tone === "gold";
  const activeBg = gold ? "bg-gold-dark" : "bg-terra";
  const activeText = gold ? "text-gold-dark" : "text-terra";

  // Ítem suelto (Inicio): un link, sin despliegue.
  if (!group.children) {
    return (
      <li>
        <Link
          href={group.href ?? "/admin"}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
            isActiveGroup ? `${activeBg} text-white shadow-card-soft` : "text-dark hover:bg-bg"
          }`}
        >
          <Icon size={18} />
          <span>{group.label}</span>
        </Link>
      </li>
    );
  }

  // Regla 3: el título de la categoría no navega, solo despliega.
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition hover:bg-bg ${
          isActiveGroup ? activeText : "text-dark"
        }`}
      >
        <Icon size={18} />
        <span className="flex-1">{group.label}</span>
        <IconChevronDown
          size={14}
          className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <ul className="mb-1 ml-[21px] flex flex-col gap-0.5 border-l border-black/[0.08] pl-3">
          {group.children.map((leaf) => {
            const on = leaf.href === activeHref;
            return (
              <li key={leaf.href}>
                <Link
                  href={leaf.href}
                  onClick={onNavigate}
                  className={`block rounded-lg px-3 py-2 text-[12.5px] transition ${
                    on
                      ? `${activeBg} font-semibold text-white shadow-card-soft`
                      : "font-medium text-dark/80 hover:bg-bg hover:text-dark"
                  }`}
                >
                  {leaf.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
