import Link from "next/link";
import { Card, PageHeader } from "@/components/admin/ui";
import { IconArrowRight } from "@/components/Icons";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HANDOVER_STEPS, getTreasuryGuide, type StepStatus } from "@/lib/treasury-guide";

export const dynamic = "force-dynamic";

/**
 * La Guía del mes: el ciclo de la Tesorería, paso a paso, con el estado
 * de cada paso para el mes que se está cerrando y el link a la pantalla
 * donde se hace. Pensada para quien agarra el cargo sin conocer la app:
 * es la documentación viva, no un manual aparte.
 */

const STATUS: Record<StepStatus, { label: string; color: string; bg: string }> = {
  hecho: { label: "Hecho", color: "#6A8B5F", bg: "#6A8B5F1A" },
  pendiente: { label: "Pendiente", color: "#B7791F", bg: "#B7791F1A" },
  manual: { label: "A tu criterio", color: "#7A7A8C", bg: "#7A7A8C1A" },
  desconocido: { label: "Sin datos", color: "#7A7A8C", bg: "#7A7A8C1A" },
};

export default async function GuiaPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const guide = await getTreasuryGuide(supabase, {
    localityId: session.locality.id,
    localityKind: session.locality.kind ?? "ael",
  });

  const done = guide.steps.filter((s) => s.status === "hecho").length;
  const pending = guide.steps.filter((s) => s.status === "pendiente").length;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Guía del mes"
        description={`El ciclo de la Tesorería, paso a paso, para ${guide.monthLabel.toLowerCase()}: qué se hace, por qué, dónde, y qué ya está hecho.`}
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
              Cerrando {guide.monthLabel}
            </div>
            <div className="mt-1 font-display text-[22px] font-semibold text-dark">
              {pending === 0
                ? "Todo lo que la app puede verificar está hecho."
                : `${pending} ${pending === 1 ? "paso pendiente" : "pasos pendientes"}`}
            </div>
          </div>
          <div className="text-[12.5px] text-muted">
            {done} de {guide.steps.length} pasos verificados como hechos. Los marcados «a tu
            criterio» la app no puede comprobarlos.
          </div>
        </div>
      </Card>

      <ol className="flex flex-col gap-3">
        {guide.steps.map((step) => {
          const st = STATUS[step.status];
          return (
            <li key={step.key}>
              <Card>
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-[18px] font-bold"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {step.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[19px] font-semibold text-dark">
                        {step.title}
                      </h2>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    {step.note && (
                      <p className="mt-1 text-[12.5px] font-semibold" style={{ color: st.color }}>
                        {step.note}
                      </p>
                    )}
                    <p className="mt-2 text-[13px] leading-relaxed text-dark/80">{step.why}</p>
                    <ul className="mt-2 flex flex-col gap-1 text-[13px] text-dark/85">
                      {step.how.map((h) => (
                        <li key={h} className="flex gap-2">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href={step.href}
                    className="tap inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl border border-black/10 bg-card px-4 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
                  >
                    {step.cta} <IconArrowRight size={12} />
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        <div className="text-[10px] font-semibold uppercase tracking-[2px] text-gold-dark">
          Cuando cambia el tesorero
        </div>
        <h2 className="mt-1 font-display text-[22px] font-semibold text-dark">
          Los cinco pasos del traspaso
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          En este orden. Todo queda registrado: los recibos viejos siguen con la firma y el
          nombre de quien los emitió.
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {HANDOVER_STEPS.map((step, i) => (
            <li key={step.title}>
              <Card>
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 font-display text-[18px] font-bold text-gold-dark">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[17px] font-semibold text-dark">{step.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-dark/80">{step.detail}</p>
                  </div>
                  <Link
                    href={step.href}
                    className="tap inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl border border-black/10 bg-card px-4 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
                  >
                    {step.cta} <IconArrowRight size={12} />
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
