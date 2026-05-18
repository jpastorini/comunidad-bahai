import Link from "next/link";
import { formatActivityWhen } from "@/lib/format";
import type { Activity } from "@/lib/types";

export function UpcomingActivities({ activities }: { activities: Activity[] }) {
  return (
    <section className="mb-3.5">
      <h2 className="mb-2.5 font-sans text-[14px] font-semibold text-dark">
        Próximamente
      </h2>
      <div className="flex gap-[9px]">
        {activities.map((a) => {
          const when = formatActivityWhen(a.starts_at);
          return (
            <Link
              key={a.id}
              href="/actividades"
              className="tap flex-1 rounded-[14px] bg-card p-3 shadow-card"
            >
              <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.3px] text-terra">
                {when.dayLabel === when.fullLabel.split(" ")[1]
                  ? `${when.fullLabel.split(" ")[0]} ${when.dayLabel}`
                  : when.fullLabel}
                {" · "}
                {when.time}
              </div>
              <div className="mb-1 text-[12.5px] font-semibold leading-[1.3] text-dark">
                {a.title}
              </div>
              <div className="font-body text-[10.5px] text-muted">{a.detail}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
