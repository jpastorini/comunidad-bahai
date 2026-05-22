import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { getCalendarEvents } from "@/lib/data";
import { effectiveEventColor, getCalendarKind } from "@/lib/calendar-kinds";

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

// View locked to May 2026 to match the design prototype. To wire up
// a real "current month" view, replace these constants and recompute
// `firstWeekdayOffset` / `daysInMonth`.
const CURRENT_MONTH = 5;
const CURRENT_YEAR = 2026;
const TODAY = 17;

export default async function CalendarioPage() {
  const events = await getCalendarEvents();

  const firstWeekdayJsLikeMonday = (() => {
    // JS getDay: 0=Sun..6=Sat; we want Mon=0..Sun=6
    const firstDate = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1);
    const js = firstDate.getDay();
    return (js + 6) % 7;
  })();

  const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH, 0).getDate();

  const eventsByDay = new Map<number, (typeof events)[number]>();
  for (const e of events) {
    if (e.month === CURRENT_MONTH && e.year === CURRENT_YEAR) {
      eventsByDay.set(e.day, e);
    }
  }

  return (
    <>
      <GoldHeader title="Calendario" subtitle="Mayo 2026" backHref="/" />
      <main className="scroll-area flex-1 px-4 pt-3.5">
        {/* Calendar grid */}
        <div className="mb-3.5 rounded-[18px] bg-card p-4 shadow-card-elevated">
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="py-1.5 text-[10px] font-semibold uppercase text-muted"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: firstWeekdayJsLikeMonday }).map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === TODAY;
              const event = eventsByDay.get(day);
              const eventColor = event
                ? effectiveEventColor(event.kind, event.color)
                : null;
              return (
                <div
                  key={day}
                  className="mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-full text-[13px]"
                  style={{
                    fontWeight: isToday || event ? 600 : 400,
                    background: isToday
                      ? "#2A3F8F"
                      : eventColor
                      ? `${eventColor}10`
                      : "transparent",
                    color: isToday
                      ? "#fff"
                      : eventColor
                      ? eventColor
                      : "#2A2833",
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10.5px] text-muted">
          <LegendDot kind="fiesta_19_dias" />
          <LegendDot kind="dia_sagrado_no_trabajo" />
          <LegendDot kind="dia_sagrado_con_trabajo" />
          <LegendDot kind="actividad_general" />
        </div>

        {/* Upcoming events */}
        <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
          Próximos eventos
        </h2>
        <div className="flex flex-col gap-2 pb-3.5">
          {events.map((e) => {
            const kindMeta = getCalendarKind(e.kind);
            const eventColor = effectiveEventColor(e.kind, e.color);
            return (
              <Link
                key={e.id}
                href={`/calendario/${e.id}`}
                className="tap flex items-center gap-3 rounded-[14px] bg-card px-3.5 py-3 shadow-card-soft"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${eventColor}10` }}
                >
                  <span
                    className="font-display text-base font-bold"
                    style={{ color: eventColor }}
                  >
                    {e.day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-dark">
                      {e.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-body text-[11px] text-muted">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
                      style={{
                        background: `${kindMeta.color}15`,
                        color: kindMeta.color,
                      }}
                    >
                      {kindMeta.short}
                    </span>
                    <span>{e.time}</span>
                    {e.location && (
                      <>
                        <span>·</span>
                        <span className="truncate">{e.location}</span>
                      </>
                    )}
                  </div>
                </div>
                {e.image_url && (
                  <span className="shrink-0 rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-gold-dark">
                    IMG
                  </span>
                )}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

function LegendDot({
  kind,
}: {
  kind: Parameters<typeof getCalendarKind>[0];
}) {
  const meta = getCalendarKind(kind);
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: meta.color }}
      />
      <span>{meta.label}</span>
    </span>
  );
}
