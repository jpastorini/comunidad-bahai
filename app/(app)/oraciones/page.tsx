import Link from "next/link";
import { BibliotecaSearchBox } from "@/components/BibliotecaSearchBox";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChevronRight } from "@/components/Icons";
import { BIBLIOTECA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getCitaDelDia } from "@/lib/citas";
import { getOraciones } from "@/lib/oraciones";

export const revalidate = 60;

/**
 * Oraciones es la primera pantalla de la Biblioteca (lo que se abre todos
 * los días). Mismo marco que Mensajes y Materiales: cuadro de búsqueda y
 * segmentos arriba.
 */
export default async function OracionesPage() {
  const session = await requireMember("/oraciones");
  const { groups } = getOraciones();
  // Determinística por fecha, sin consulta: la misma que muestra el Inicio.
  const { topic } = getCitaDelDia();

  return (
    <>
      <GoldHeader title="Biblioteca" subtitle={session.locality.name} backHref="/" />
      <BibliotecaSearchBox />
      <SegmentedNav items={BIBLIOTECA_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-6 pt-1">
        {/* La Lectura de hoy también es de la Biblioteca: queda a mano
            junto a las oraciones, no solo en el Inicio. */}
        <Link
          href="/citas?volver=oraciones"
          className="tap mb-4 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card-soft ring-1 ring-gold/15"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[15px] text-gold-dark"
            style={{ background: "#C4A23514" }}
          >
            ✦
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-dark">
              Lectura de hoy
            </div>
            <div className="mt-0.5 truncate font-body text-[11.5px] text-muted">
              {topic.name} · Escritos Sagrados por tema
            </div>
          </div>
          <IconChevronRight size={14} className="shrink-0 text-muted" />
        </Link>

        <p className="mb-4 px-1 font-body text-[12.5px] leading-relaxed text-muted">
          Oraciones reveladas por el Báb, Bahá'u'lláh y ʻAbdu'l-Bahá,
          organizadas por tema.
        </p>

        {groups.map((group) => (
          <section key={group.id} className="mb-5">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {group.name}
            </h2>
            <div className="overflow-hidden rounded-2xl bg-card shadow-card-soft">
              {group.categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/oraciones/${cat.id}`}
                  className={`tap flex items-center gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-black/[0.05]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 text-[14px] font-medium text-dark">
                    {cat.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">
                    {cat.prayers.length}
                  </span>
                  <IconChevronRight size={14} className="shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
