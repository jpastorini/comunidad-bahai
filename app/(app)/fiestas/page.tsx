import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { celebrationDateFor, getBahaiMonth } from "@/lib/bahai-calendar";
import { getFeasts } from "@/lib/data";

export const dynamic = "force-dynamic";

const WEEKDAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function FiestasPage() {
  const feasts = await getFeasts();
  const todayIso = new Date().toISOString().slice(0, 10);

  // Ya filtramos drafts por RLS, pero defensivamente.
  const visible = feasts.filter((f) => f.status !== "draft");

  const inProgress = visible.find((f) => f.status === "in_progress");
  const upcoming = visible
    .filter(
      (f) =>
        f.status === "published" &&
        (f.gregorian_date ?? "9999-99-99") >= todayIso &&
        f.id !== inProgress?.id
    )
    .sort((a, b) =>
      (a.gregorian_date ?? "").localeCompare(b.gregorian_date ?? "")
    );
  const past = visible
    .filter(
      (f) =>
        (f.gregorian_date ?? "0") < todayIso &&
        f.id !== inProgress?.id
    )
    .sort((a, b) =>
      (b.gregorian_date ?? "").localeCompare(a.gregorian_date ?? "")
    );

  return (
    <>
      <GoldHeader
        title="Fiestas de 19 Días"
        subtitle="Vida espiritual de la comunidad"
        backHref="/"
      />
      <main className="scroll-area flex-1 px-4 pb-4 pt-4">
        {visible.length === 0 && (
          <div className="py-12 text-center text-[13px] text-muted">
            Aún no hay Fiestas publicadas por la Asamblea.
          </div>
        )}

        {inProgress && <FeastCard feast={inProgress} highlight />}

        {upcoming.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Próximamente
            </h2>
            <div className="flex flex-col gap-2.5">
              {upcoming.map((f) => (
                <FeastCard key={f.id} feast={f} />
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted">
              Fiestas pasadas
            </h2>
            <div className="flex flex-col gap-2.5">
              {past.map((f) => (
                <FeastCard key={f.id} feast={f} muted />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

type Feast = Awaited<ReturnType<typeof getFeasts>>[number];

function FeastCard({
  feast,
  highlight = false,
  muted = false,
}: {
  feast: Feast;
  highlight?: boolean;
  muted?: boolean;
}) {
  const meta = getBahaiMonth(feast.bahai_month_index);
  return (
    <Link
      href={`/fiestas/${feast.id}`}
      className={`tap block rounded-2xl p-4 shadow-card ${
        highlight
          ? "bg-terra-grad text-white"
          : muted
            ? "bg-card opacity-70"
            : "bg-card"
      }`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${
          highlight ? "text-white/70" : "text-gold-dark"
        }`}
      >
        {highlight
          ? "✦ Programa disponible"
          : `Mes ${feast.bahai_month_index} de 19`}
      </div>
      <div
        className={`mt-1 font-display text-[22px] font-semibold leading-tight ${
          highlight ? "text-white" : "text-dark"
        }`}
      >
        Fiesta de {feast.bahai_month_name}
        {meta?.meaning && (
          <span
            className={`ml-2 text-[14px] font-normal ${
              highlight ? "text-white/75" : "text-muted"
            }`}
          >
            · {meta.meaning}
          </span>
        )}
      </div>

      {feast.gregorian_date && (
        <FeastDates date={feast.gregorian_date} highlight={highlight} />
      )}
    </Link>
  );
}

function FeastDates({
  date,
  highlight,
}: {
  date: string;
  highlight: boolean;
}) {
  const official = new Date(`${date}T12:00:00Z`);
  const celebration = new Date(`${celebrationDateFor(date)}T12:00:00Z`);
  const officialLabel = formatLongDate(official);
  const celebrationLabel = formatLongDate(celebration);

  return (
    <div className="mt-2.5 grid gap-1">
      <div
        className={`text-[10.5px] uppercase tracking-wide ${
          highlight ? "text-white/65" : "text-muted"
        }`}
      >
        Inicio del mes
      </div>
      <div
        className={`text-[12.5px] ${
          highlight ? "text-white/90" : "text-dark"
        }`}
      >
        {officialLabel}
      </div>
      <div
        className={`mt-1.5 text-[10.5px] uppercase tracking-wide ${
          highlight ? "text-white" : "text-terra"
        }`}
      >
        Celebración
      </div>
      <div
        className={`text-[13px] font-semibold ${
          highlight ? "text-white" : "text-terra"
        }`}
      >
        {celebrationLabel} al atardecer
      </div>
    </div>
  );
}

function formatLongDate(d: Date): string {
  const weekday = WEEKDAYS_ES[d.getUTCDay()];
  const day = d.getUTCDate();
  const month = MONTHS_ES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${weekday} ${day} de ${month} ${year}`;
}
