import Link from "next/link";
import { CALENDAR_KINDS } from "@/lib/calendar-kinds";
import type { UnifiedCalendarItem } from "@/lib/data";

// Grilla mensual gregoriana del panel: la vista centralizada de todo lo
// que la Asamblea tiene entre manos (eventos, Fiestas, Días Sagrados,
// reuniones AEL). Server component: la navegación entre meses son links
// con ?m=YYYY-MM, igual que en el calendario de los miembros.

const WEEKDAYS_ES = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
];
const MONTHS_ES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_ES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function MonthGrid({
  items,
  month,
  year,
}: {
  items: UnifiedCalendarItem[];
  month: number;
  year: number;
}) {
  const today = new Date();
  const isCurrentMonth =
    month === today.getMonth() + 1 && year === today.getFullYear();
  const todayDay = isCurrentMonth ? today.getDate() : null;

  const monthItems = items
    .filter((i) => i.month === month && i.year === year)
    .sort((a, b) => a.day - b.day);
  const itemsByDay = new Map<number, UnifiedCalendarItem[]>();
  for (const i of monthItems) {
    const arr = itemsByDay.get(i.day) ?? [];
    arr.push(i);
    itemsByDay.set(i.day, arr);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay() da 0=domingo; la grilla arranca en lunes.
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const prev = monthOffset(month, year, -1);
  const next = monthOffset(month, year, +1);

  return (
    <div>
      {/* Navegador de mes */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <NavLink target={prev} year={year} direction="prev" />
        <div className="flex items-center gap-3">
          <h2 className="font-display text-[18px] font-semibold text-dark">
            {MONTHS_ES_LONG[month - 1]} {year}
          </h2>
          {!isCurrentMonth && (
            <Link
              href="/admin/calendario"
              className="text-[11px] font-semibold text-muted hover:text-terra hover:underline"
            >
              Volver a hoy
            </Link>
          )}
        </div>
        <NavLink target={next} year={year} direction="next" />
      </div>

      {/* Grilla */}
      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-card shadow-card">
        <div className="grid min-w-[820px] grid-cols-7 gap-px bg-black/[0.06]">
          {WEEKDAYS_ES.map((d) => (
            <div
              key={d}
              className="bg-bg/60 px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: totalCells }).map((_, cell) => {
            const day = cell - leadingBlanks + 1;
            if (day < 1 || day > daysInMonth) {
              return <div key={`b${cell}`} className="min-h-[104px] bg-bg/40" />;
            }
            const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = day === todayDay;
            const dayItems = itemsByDay.get(day) ?? [];
            return (
              <div
                key={day}
                className={`group relative min-h-[104px] px-1.5 pb-1.5 pt-1 ${
                  isToday ? "bg-terra/[0.05]" : "bg-card"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                      isToday
                        ? "bg-terra font-bold text-white"
                        : "font-semibold text-dark"
                    }`}
                  >
                    {day}
                  </span>
                  <Link
                    href={`/admin/calendario/nuevo?fecha=${iso}`}
                    title={`Nuevo evento el ${day}/${month}`}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[14px] font-semibold leading-none text-muted opacity-0 transition hover:bg-terra/10 hover:text-terra focus:opacity-100 group-hover:opacity-100"
                  >
                    +
                  </Link>
                </div>
                <div className="flex flex-col gap-1">
                  {dayItems.map((i) => (
                    <ItemChip key={`${i.source}-${i.id}`} item={i} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
        {Object.values(CALENDAR_KINDS).map((k) => (
          <span key={k.id} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: k.color }}
            />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ItemChip({ item }: { item: UnifiedCalendarItem }) {
  // Una Fiesta sin publicar solo la ve la Asamblea: se distingue con
  // borde punteado para que el estado no pase desapercibido.
  const isDraftFeast = item.source === "feast" && item.feastStatus === "draft";
  const tooltip = [
    item.title,
    item.time,
    item.location ?? undefined,
    isDraftFeast ? "(sin publicar)" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={item.adminHref}
      title={tooltip}
      className="block truncate rounded-md px-1.5 py-1 text-[11px] font-semibold leading-tight transition hover:brightness-95"
      style={{
        background: `${item.color}14`,
        color: item.color,
        border: isDraftFeast ? `1px dashed ${item.color}80` : "1px solid transparent",
      }}
    >
      {item.title}
      <span className="ml-1 font-normal opacity-75">{item.time}</span>
    </Link>
  );
}

function NavLink({
  target,
  year,
  direction,
}: {
  target: { month: number; year: number };
  year: number;
  direction: "prev" | "next";
}) {
  const chevron =
    direction === "prev" ? (
      <polyline points="15 18 9 12 15 6" />
    ) : (
      <polyline points="9 18 15 12 9 6" />
    );
  const label = (
    <>
      {MONTHS_ES_SHORT[target.month - 1]}
      {target.year !== year && (
        <span className="text-muted">{target.year}</span>
      )}
    </>
  );
  return (
    <Link
      href={`/admin/calendario?m=${target.year}-${String(target.month).padStart(2, "0")}`}
      className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-card px-3 py-2 text-[12px] font-semibold text-terra transition hover:bg-bg"
    >
      {direction === "prev" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {chevron}
        </svg>
      )}
      {label}
      {direction === "next" && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {chevron}
        </svg>
      )}
    </Link>
  );
}

export function monthOffset(
  month: number,
  year: number,
  offset: number
): { month: number; year: number } {
  const total = year * 12 + (month - 1) + offset;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function parseMonthParam(
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
