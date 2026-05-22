import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { effectiveEventColor, getCalendarKind } from "@/lib/calendar-kinds";
import { getCalendarEvent } from "@/lib/data";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const WEEKDAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await getCalendarEvent(params.id);
  if (!event) notFound();

  const date = new Date(event.year, event.month - 1, event.day);
  const weekday = WEEKDAYS_ES[date.getDay()];
  const monthName = MONTHS_ES[event.month - 1];
  const kindMeta = getCalendarKind(event.kind);
  const accent = effectiveEventColor(event.kind, event.color);

  return (
    <>
      <GoldHeader
        title={event.title}
        subtitle={`${weekday} ${event.day} de ${monthName}`}
        backHref="/calendario"
      />

      <main className="scroll-area flex-1 pb-4">
        {event.image_url && (
          <div className="bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt={event.title}
              className="block w-full max-h-[420px] object-contain"
            />
          </div>
        )}

        <div className="px-4 pt-4">
          {/* Kind badge */}
          <div className="mb-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide"
              style={{ background: `${kindMeta.color}15`, color: kindMeta.color }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: kindMeta.color }}
              />
              {kindMeta.label}
            </span>
          </div>

          {/* Date / time / place card */}
          <div
            className="mb-4 flex items-stretch gap-3 overflow-hidden rounded-2xl bg-card shadow-card"
          >
            <div
              className="flex w-16 shrink-0 flex-col items-center justify-center text-white"
              style={{ background: accent }}
            >
              <div className="font-display text-[24px] font-bold leading-none">
                {event.day}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-90">
                {monthName.slice(0, 3)}
              </div>
            </div>
            <div className="flex-1 py-3 pr-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {weekday}
              </div>
              <div className="text-[14px] font-semibold text-dark">
                {event.time}
                {event.duration_minutes ? (
                  <span className="ml-2 text-[11px] font-normal text-muted">
                    · {event.duration_minutes} min
                  </span>
                ) : null}
              </div>
              {event.location && (
                <div className="mt-1 flex items-center gap-1 text-[12px] text-dark">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </div>

          {event.description && (
            <article className="mb-4 rounded-2xl bg-card p-4 shadow-card-soft">
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                Descripción
              </h2>
              <p className="whitespace-pre-line font-body text-[13px] leading-[1.55] text-dark">
                {event.description}
              </p>
            </article>
          )}

          {/* CTA: add to calendar */}
          <a
            href={`/calendario/${event.id}/ics`}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-terra px-4 py-3 text-[13px] font-semibold text-white shadow-card-soft"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" />
              <line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            Añadir a mi calendario
          </a>
          <p className="mt-2 text-center text-[10.5px] text-muted">
            Descarga el evento como archivo .ics. Tu teléfono lo abre con
            Calendar / Google Calendar / Outlook.
          </p>
        </div>
      </main>
    </>
  );
}
