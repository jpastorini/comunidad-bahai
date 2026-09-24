import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getServiceBoard } from "@/lib/service";
import { createSupabaseServer } from "@/lib/supabase/server";
import { colors } from "@/lib/tokens";
import type { ServiceUrgency } from "@/lib/types";
import { VolunteerButton } from "./volunteer-button";

const URGENCY_COLOR: Record<ServiceUrgency, string> = {
  alta: colors.terra,
  media: colors.amber,
  baja: colors.gold,
};

const URGENCY_LABEL: Record<ServiceUrgency, string> = {
  alta: "Urgente",
  media: "Pronto",
  baja: "Cuando se pueda",
};

export default async function ServicioPage() {
  const session = await requireMember("/servicio");
  const needs = await getServiceBoard(createSupabaseServer(), session.user.id);

  return (
    <>
      <GoldHeader
        title="Servicio"
        subtitle="Necesidades de la comunidad"
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pt-3.5">
        {needs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] text-muted">
              Por ahora la Asamblea no publicó necesidades de servicio.
            </p>
            <p className="mt-1.5 font-body text-[12px] text-muted">
              Cuando haya algo en lo que se pueda ayudar, va a aparecer acá y
              te vas a poder ofrecer con un toque.
            </p>
          </div>
        ) : (
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
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: `${color}12`, color }}
                    >
                      {URGENCY_LABEL[n.urgency]}
                    </span>
                  </div>
                  <p className="mb-3 whitespace-pre-line font-body text-[12.5px] leading-[1.5] text-muted">
                    {n.description}
                  </p>
                  <VolunteerButton
                    needId={n.id}
                    initialMine={n.mine}
                    initialCount={n.volunteers}
                  />
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
