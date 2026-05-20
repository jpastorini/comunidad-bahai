import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import {
  IconActividades,
  IconChat,
  IconChevronRight,
  IconMateriales,
  IconMensajes,
  IconTesoreria,
} from "@/components/Icons";
import { colors } from "@/lib/tokens";

const ITEMS = [
  {
    href: "/chat",
    label: "Chat con Secretaría",
    sub: "Asamblea Local",
    Icon: IconChat,
    color: colors.amber,
  },
  {
    href: "/actividades",
    label: "Actividades Locales",
    sub: "Próximas reuniones",
    Icon: IconActividades,
    color: colors.terra,
  },
  {
    href: "/materiales",
    label: "Materiales de Estudio",
    sub: "Libros y escritos",
    Icon: IconMateriales,
    color: colors.amber,
  },
  {
    href: "/comunicados",
    label: "Comunicados",
    sub: "Asamblea Espiritual Local",
    Icon: IconMensajes,
    color: colors.terra,
  },
  {
    href: "/tesoreria",
    label: "Tesorería",
    sub: "Fondo y contribuciones",
    Icon: IconTesoreria,
    color: colors.amber,
  },
];

export default function MasPage() {
  return (
    <>
      <GoldHeader title="Más" subtitle="Todas las secciones" />
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
      </main>
    </>
  );
}
