import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { CALENDARIO_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getCalendarKind } from "@/lib/calendar-kinds";
import { getUnifiedCalendarItems, type UnifiedCalendarItem } from "@/lib/data";

export const dynamic = "force-dynamic";

const WEEKDAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function dayKey(i: { year: number; month: number; day: number }): number {
  return i.year * 10000 + i.month * 100 + i.day;
}

function formatLongDate(i: UnifiedCalendarItem): string {
  const d = new Date(i.year, i.month - 1, i.day);
  return `${WEEKDAYS_ES[d.getDay()]} ${i.day} de ${MONTHS_ES[i.month - 1]} ${i.year}`;
}

export default async function DiasSagradosPage() {
  const [session, allItems] = await Promise.all([
    requireMember("/dias-sagrados"),
    getUnifiedCalendarItems(),
  ]);

  const holyDays = allItems
    .filter(
      (i) =>
        i.kind === "dia_sagrado_no_trabajo" ||
        i.kind === "dia_sagrado_con_trabajo"
    )
    .sort((a, b) => dayKey(a) - dayKey(b));

  const today = new Date();
  const todayKey =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();

  const upcoming = holyDays.filter((i) => dayKey(i) >= todayKey);
  const past = holyDays.filter((i) => dayKey(i) < todayKey).reverse();

  return (
    <>
      <GoldHeader title="Calendario" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={CALENDARIO_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        {holyDays.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            Aún no hay Días Sagrados cargados para esta localidad.
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <h2 className="mb-2 mt-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Próximos
                </h2>
                <div className="flex flex-col gap-2.5">
                  {upcoming.map((i) => (
                    <HolyDayCard key={`${i.source}-${i.id}`} item={i} />
                  ))}
                </div>
              </>
            )}

            {past.length > 0 && (
              <>
                <h2 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Pasados
                </h2>
                <div className="flex flex-col gap-2.5">
                  {past.map((i) => (
                    <HolyDayCard key={`${i.source}-${i.id}`} item={i} muted />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

function HolyDayCard({
  item,
  muted = false,
}: {
  item: UnifiedCalendarItem;
  muted?: boolean;
}) {
  const meta = getCalendarKind(item.kind);
  const worksLabel =
    item.kind === "dia_sagrado_no_trabajo"
      ? "Se suspende el trabajo"
      : "No se suspende el trabajo";

  return (
    <Link
      href={item.href}
      className={`tap flex items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 shadow-card ${
        muted ? "opacity-70" : ""
      }`}
    >
      <div
        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl"
        style={{ background: `${item.color}10` }}
      >
        <span
          className="font-display text-[17px] font-bold leading-none"
          style={{ color: item.color }}
        >
          {item.day}
        </span>
        <span
          className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.5px]"
          style={{ color: item.color }}
        >
          {MONTHS_ES[item.month - 1].slice(0, 3)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-semibold leading-[1.3] text-dark">
          {item.title}
        </h3>
        <div className="mt-0.5 font-body text-[11px] text-muted">
          {formatLongDate(item)} · {item.time}
        </div>
        <span
          className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
          style={{ background: `${meta.color}15`, color: meta.color }}
        >
          {worksLabel}
        </span>
      </div>
    </Link>
  );
}
