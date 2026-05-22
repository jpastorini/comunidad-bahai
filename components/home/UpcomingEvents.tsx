import Link from "next/link";
import { effectiveEventColor } from "@/lib/calendar-kinds";
import type { CalendarEvent } from "@/lib/types";

const MONTHS_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const WEEKDAYS_SHORT_ES = [
  "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb",
];

export function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="mb-3.5">
        <h2 className="mb-2.5 font-sans text-[14px] font-semibold text-dark">
          Próximamente
        </h2>
        <div className="rounded-[14px] bg-card p-4 text-center text-[12px] text-muted shadow-card-soft">
          Sin eventos próximos.
        </div>
      </section>
    );
  }

  return (
    <section className="mb-3.5">
      <h2 className="mb-2.5 font-sans text-[14px] font-semibold text-dark">
        Próximamente
      </h2>
      <div className="flex gap-[9px]">
        {events.map((e) => {
          const date = new Date(e.year, e.month - 1, e.day);
          const weekday = WEEKDAYS_SHORT_ES[date.getDay()];
          const monthShort = MONTHS_SHORT_ES[e.month - 1];
          const accent = effectiveEventColor(e.kind, e.color);
          return (
            <Link
              key={e.id}
              href={`/calendario/${e.id}`}
              className="tap flex-1 rounded-[14px] bg-card p-3 shadow-card"
            >
              <div
                className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.3px]"
                style={{ color: accent }}
              >
                {weekday} {e.day} {monthShort} · {e.time}
              </div>
              <div className="mb-1 text-[12.5px] font-semibold leading-[1.3] text-dark line-clamp-2">
                {e.title}
              </div>
              {e.location && (
                <div className="font-body text-[10.5px] text-muted line-clamp-1">
                  {e.location}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
