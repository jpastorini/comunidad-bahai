import { GoldHeader } from "@/components/GoldHeader";
import { CALENDARIO_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getActivities } from "@/lib/data";
import { formatActivityWhen } from "@/lib/format";
import { colors } from "@/lib/tokens";
import type { ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ActivityType, string> = {
  estudio: "Estudio",
  devocional: "Devocional",
  ninos: "Niños",
  jovenes: "Jóvenes",
};

const TYPE_COLOR: Record<ActivityType, string> = {
  estudio: colors.terra,
  devocional: colors.amber,
  ninos: colors.green,
  jovenes: colors.gold,
};

export default async function ActividadesPage() {
  const [session, activities] = await Promise.all([
    requireMember("/actividades"),
    getActivities(),
  ]);

  return (
    <>
      <GoldHeader title="Calendario" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={CALENDARIO_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pt-1">
        <div className="flex flex-col gap-2.5 pb-3.5">
          {activities.map((a) => {
            const when = formatActivityWhen(a.starts_at);
            const color = TYPE_COLOR[a.type];
            return (
              <article
                key={a.id}
                className="flex items-start gap-3.5 rounded-2xl bg-card px-4 py-3.5 shadow-card"
              >
                <div
                  className="flex min-h-[52px] w-12 shrink-0 flex-col items-center justify-center rounded-xl px-1 py-2"
                  style={{ background: `${color}10` }}
                >
                  <div
                    className="font-display text-base font-bold leading-none"
                    style={{ color }}
                  >
                    {when.dayLabel}
                  </div>
                  <div
                    className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.5px]"
                    style={{ color }}
                  >
                    {when.weekdayLabel}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className="mb-1 inline-block rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.5px]"
                    style={{ background: `${color}10`, color }}
                  >
                    {TYPE_LABEL[a.type]}
                  </span>
                  <h3 className="mb-0.5 text-[14px] font-semibold leading-[1.3] text-dark">
                    {a.title}
                  </h3>
                  <p className="mb-0.5 font-body text-[11px] text-muted">
                    {a.detail}
                  </p>
                  <div className="flex items-center gap-2 font-body text-[10.5px] text-muted">
                    <span>{when.time}</span>
                    <span>·</span>
                    <span>{a.place}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
