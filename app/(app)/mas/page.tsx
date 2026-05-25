import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import {
  IconChat,
  IconChevronRight,
  IconTesoreria,
} from "@/components/Icons";
import { requireMember } from "@/lib/auth";
import { colors } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const ITEMS = [
  {
    href: "/chat",
    label: "Chat con Secretaría",
    sub: "Asamblea Local",
    Icon: IconChat,
    color: colors.amber,
  },
  {
    href: "/tesoreria",
    label: "Tesorería",
    sub: "Fondo y contribuciones",
    Icon: IconTesoreria,
    color: colors.terra,
  },
];

export default async function MasPage() {
  const session = await requireMember("/mas");

  return (
    <>
      <GoldHeader title="Más" subtitle={session.locality.name} />
      <main className="scroll-area flex-1 px-4 pt-3.5">
        <ul className="flex flex-col gap-2 pb-3.5">
          {ITEMS.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="tap flex items-center gap-3.5 rounded-[14px] bg-card px-4 py-3.5 shadow-card-soft"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                  style={{ background: `${it.color}10`, color: it.color }}
                >
                  <it.Icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-dark">
                    {it.label}
                  </div>
                  <div className="mt-0.5 font-body text-[11px] text-muted">
                    {it.sub}
                  </div>
                </div>
                <IconChevronRight size={14} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>

        {/* Configuración del usuario */}
        <div className="mt-4 mb-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Mi cuenta
        </div>
        <ul className="flex flex-col gap-2 pb-6">
          <li>
            <Link
              href="/perfil"
              className="tap flex items-center gap-3.5 rounded-[14px] bg-card px-4 py-3.5 shadow-card-soft"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                style={{ background: `${colors.terra}10`, color: colors.terra }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-dark">
                  Mi perfil
                </div>
                <div className="mt-0.5 font-body text-[11px] text-muted">
                  Nombre, foto, mis fotos compartidas
                </div>
              </div>
              <IconChevronRight size={14} className="text-muted" />
            </Link>
          </li>
          <li className="rounded-[14px] bg-card p-4 shadow-card-soft">
            <div className="text-[11px] uppercase tracking-wide text-muted">
              Localidad actual
            </div>
            <div className="mt-0.5 font-display text-[16px] font-semibold text-dark">
              {session.locality.name}
            </div>
            {session.locality.city && (
              <div className="mt-0.5 font-body text-[11px] text-muted">
                {session.locality.city} · {session.locality.country}
              </div>
            )}
            <Link
              href="/seleccionar-localidad?error=missing"
              className="mt-3 inline-block text-[12px] font-semibold text-terra hover:underline"
            >
              Cambiar de localidad →
            </Link>
          </li>
          <li>
            <form
              action="/auth/signout"
              method="post"
              className="tap flex items-center gap-3.5 rounded-[14px] bg-card px-4 py-3.5 shadow-card-soft"
            >
              <button
                type="submit"
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <div className="text-[13px] font-semibold text-dark">
                    Cerrar sesión
                  </div>
                  <div className="mt-0.5 font-body text-[11px] text-muted">
                    {session.user.email}
                  </div>
                </div>
                <IconChevronRight size={14} className="text-muted" />
              </button>
            </form>
          </li>
        </ul>
      </main>
    </>
  );
}
