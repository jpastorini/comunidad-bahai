import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { getCalendarKind } from "@/lib/calendar-kinds";
import { getUnifiedCalendarItems } from "@/lib/data";

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MONTHS_ES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_ES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const today = new Date();
  const { month, year } = parseMonthParam(searchParams?.m, today);

  const isCurrentMonth =
    month === today.getMonth() + 1 && year === today.getFullYear();
  const todayDay = isCurrentMonth ? today.getDate() : null;

  const firstWeekdayJsLikeMonday = (() => {
    const firstDate = new Date(year, month - 1, 1);
    const js = firstDate.getDay();
    return (js + 6) % 7;
  })();

  const daysInMonth = new Date(year, month, 0).getDate();

  const allItems = await getUnifiedCalendarItems();
  const items = allItems
    .filter((i) => i.month === month && i.year === year)
    .sort((a, b) => a.day - b.day);

  const itemsByDay = new Map<number, (typeof items)[number]>();
  for (const i of items) {
    const existing = itemsByDay.get(i.day);
    if (!existing || rankKind(i.kind) > rankKind(existing.kind)) {
      itemsByDay.set(i.day, i);
    }
  }

  const prev = computeMonthOffset(month, year, -1);
  const next = computeMonthOffset(month, year, +1);

  return (
    <>
      <GoldHeader
        title="Calendario"
        subtitle={`${MONTHS_ES_LONG[month - 1]} ${year}`}
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pt-3.5">
        {/* Month navigator */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href={`/calendario?m=${monthParam(prev)}`}
            className="tap inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-[12px] font-semibold text-terra shadow-card-soft"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {MONTHS_ES_SHORT[prev.month - 1]}
            {prev.year !== year && <span className="text-muted">{prev.year}</span>}
          </Link>

          {!isCurrentMonth && (
            <Link
              href="/calendario"
              className="text-[11px] font-semibold text-muted hover:text-terra hover:underline"
            >
              Volver a hoy
            </Link>
          )}

          <Link
            href={`/calendario?m=${monthParam(next)}`}
            className="tap inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-[12px] font-semibold text-terra shadow-card-soft"
          >
            {next.year !== year && <span className="text-muted">{next.year}</span>}
            {MONTHS_ES_SHORT[next.month - 1]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

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
              const isToday = day === todayDay;
              const item = itemsByDay.get(day);
              const itemColor = item?.color ?? null;
              return (
                <div
                  key={day}
                  className="mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-full text-[13px]"
                  style={{
                    fontWeight: isToday || item ? 600 : 400,
                    background: isToday
                      ? "#2A3F8F"
                      : itemColor
                      ? `${itemColor}10`
                      : "transparent",
                    color: isToday
                      ? "#fff"
                      : itemColor
                      ? itemColor
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

        {/* Month event list */}
        <h2 className="mb-2.5 text-[13px] font-semibold text-dark">
          Eventos de {MONTHS_ES_LONG[month - 1].toLowerCase()}
        </h2>
        {items.length === 0 ? (
          <div className="rounded-[14px] bg-card px-4 py-8 text-center text-[12.5px] text-muted shadow-card-soft">
            No hay eventos programados para este mes.
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-3.5">
            {items.map((i) => {
              const kindMeta = getCalendarKind(i.kind);
              return (
                <Link
                  key={`${i.source}-${i.id}`}
                  href={i.href}
                  className="tap flex items-center gap-3 rounded-[14px] bg-card px-3.5 py-3 shadow-card-soft"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${i.color}10` }}
                  >
                    <span
                      className="font-display text-base font-bold"
                      style={{ color: i.color }}
                    >
                      {i.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-dark">
                      {i.title}
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
                      <span>{i.time}</span>
                      {i.location && (
                        <>
                          <span>·</span>
                          <span className="truncate">{i.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {i.image_url && (
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
        )}
      </main>
    </>
  );
}

function parseMonthParam(
  m: string | undefined,
  today: Date
): { month: number; year: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [yStr, mStr] = m.split("-");
    const y = parseInt(yStr, 10);
    const mo = parseInt(mStr, 10);
    if (mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100) {
      return { month: mo, year: y };
    }
  }
  return { month: today.getMonth() + 1, year: today.getFullYear() };
}

function computeMonthOffset(
  month: number,
  year: number,
  offset: number
): { month: number; year: number } {
  const total = year * 12 + (month - 1) + offset;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

function monthParam({ month, year }: { month: number; year: number }): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function rankKind(kind: string): number {
  if (kind === "fiesta_19_dias") return 3;
  if (kind === "dia_sagrado_no_trabajo") return 2;
  if (kind === "dia_sagrado_con_trabajo") return 2;
  return 1;
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
