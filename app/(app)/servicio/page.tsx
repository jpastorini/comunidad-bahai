import { GoldHeader } from "@/components/GoldHeader";
import { IconArrowRight } from "@/components/Icons";
import { getServiceNeeds } from "@/lib/data";
import { colors } from "@/lib/tokens";
import type { ServiceUrgency } from "@/lib/types";

const URGENCY_COLOR: Record<ServiceUrgency, string> = {
  alta: colors.terra,
  media: colors.amber,
  baja: colors.gold,
};

const URGENCY_LABEL: Record<ServiceUrgency, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export default async function ServicioPage() {
  const needs = await getServiceNeeds();

  return (
    <>
      <GoldHeader
        title="Servicio"
        subtitle="Necesidades de la comunidad"
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pt-3.5">
        <div className="flex flex-col gap-2.5 pb-3.5">
          {needs.map((n) => {
            const color = URGENCY_COLOR[n.urgency];
            return (
              <article
                key={n.id}
                className="rounded-2xl bg-card px-4 py-3.5 shadow-card"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <h3 className="flex-1 text-[14px] font-semibold leading-[1.3] text-dark">
                    {n.title}
                  </h3>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide"
                    style={{ background: `${color}12`, color }}
                  >
                    {URGENCY_LABEL[n.urgency]}
                  </span>
                </div>
                <p className="mb-2.5 font-body text-[12px] leading-[1.5] text-muted">
                  {n.description}
                </p>
                <button
                  type="button"
                  className="tap inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-terra"
                >
                  Ofrecerme como voluntario
                  <IconArrowRight size={10} />
                </button>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
