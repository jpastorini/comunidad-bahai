import Link from "next/link";
import { Banner, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { celebrationDateFor, getBahaiMonth } from "@/lib/bahai-calendar";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { FeastStatus } from "@/lib/types";
import { ensureYearSeeded } from "@/lib/year-seed";

type FeastRow = {
  id: string;
  bahai_month_name: string;
  bahai_month_index: number;
  bahai_year: number;
  gregorian_date: string | null;
  status: FeastStatus;
  participants_total: number | null;
  locations_count: number;
  locations_with_data: number;
};

const WEEKDAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function AdminFiestasPage() {
  const session = await requireAdmin();
  const localityId = session.locality.id;
  const supabase = createSupabaseServer();

  const seedResult = await ensureYearSeeded(localityId);

  // Traer las Fiestas de esa localidad ordenadas cronológicamente.
  const { data, error: fetchError } = await supabase
    .from("feasts")
    .select(
      "id, bahai_month_name, bahai_month_index, bahai_year, gregorian_date, status, feast_locations(participant_count)"
    )
    .eq("locality_id", localityId)
    .order("gregorian_date", { ascending: true, nullsFirst: false });

  const feasts: FeastRow[] = (data ?? []).map((f) => {
    const locs = (f.feast_locations ?? []) as { participant_count: number | null }[];
    const withData = locs.filter((l) => l.participant_count != null);
    const total = withData.reduce(
      (sum, l) => sum + (l.participant_count ?? 0),
      0
    );
    return {
      id: f.id,
      bahai_month_name: f.bahai_month_name,
      bahai_month_index: f.bahai_month_index,
      bahai_year: f.bahai_year,
      gregorian_date: f.gregorian_date,
      status: f.status as FeastStatus,
      participants_total: withData.length > 0 ? total : null,
      locations_count: locs.length,
      locations_with_data: withData.length,
    };
  });

  const withStats = feasts.filter((f) => f.participants_total != null).slice(0, 6);
  const avg =
    withStats.length > 0
      ? Math.round(
          withStats.reduce((s, f) => s + (f.participants_total ?? 0), 0) /
            withStats.length
        )
      : null;

  const debugInfo =
    seedResult.errors.length > 0 || fetchError
      ? `seed: year=${seedResult.year ?? "null"} feasts=${seedResult.feastsSeeded} holyDays=${seedResult.holyDaysSeeded} errors=${seedResult.errors.join(" | ") || "—"} · fetch: ${fetchError?.message ?? "—"} · locality=${localityId}`
      : null;

  // Próxima Fiesta a celebrar: la primera cuya fecha de celebración
  // (= día anterior a la fecha oficial) sea hoy o futura. Si hay una
  // 'in_progress', esa tiene prioridad.
  const todayIso = new Date().toISOString().slice(0, 10);
  const inProgressId = feasts.find((f) => f.status === "in_progress")?.id;
  const nextToCelebrateId = inProgressId
    ? inProgressId
    : feasts.find((f) => {
        if (!f.gregorian_date) return false;
        const celebration = celebrationDateFor(f.gregorian_date);
        return celebration >= todayIso;
      })?.id;

  return (
    <>
      <PageHeader
        eyebrow="Vida comunitaria"
        title="Fiestas de los Diecinueve Días"
        description="Las 19 Fiestas del año Badí' se siembran automáticamente. Edita el programa de cada una y publícala cuando esté lista."
      />

      {debugInfo && (
        <div className="mb-5">
          <Banner tone="warning">
            <strong>Diagnóstico:</strong> {debugInfo}
          </Banner>
        </div>
      )}

      {avg !== null && (
        <div className="mb-5 rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card md:p-6">
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
            Promedio de participación
          </div>
          <div className="mt-1 flex items-end gap-3">
            <div className="font-display text-[36px] font-bold leading-none text-dark">
              {avg}
            </div>
            <div className="pb-1 text-[12px] text-muted">
              personas / Fiesta · últimas {withStats.length}{" "}
              {withStats.length === 1 ? "Fiesta" : "Fiestas"} con datos
            </div>
          </div>
        </div>
      )}

      <DataTable
        rows={feasts}
        rowKey={(f) => f.id}
        rowClassName={(f) =>
          f.id === nextToCelebrateId ? "bg-[#C4A235]/[0.06]" : undefined
        }
        empty="Cargando las Fiestas del año Badí'..."
        columns={[
          {
            key: "month",
            label: "Mes bahá'í",
            render: (f) => {
              const meta = getBahaiMonth(f.bahai_month_index);
              return (
                <div>
                  <div className="font-display text-[15px] font-semibold text-dark">
                    {f.bahai_month_name}{" "}
                    {meta?.meaning && (
                      <span className="text-[12px] font-normal text-muted">
                        · {meta.meaning}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">
                    Mes {f.bahai_month_index} de 19 · Año {f.bahai_year} BE
                  </div>
                </div>
              );
            },
          },
          {
            key: "date",
            label: "Fechas",
            width: "240px",
            render: (f) => {
              if (!f.gregorian_date) {
                return <span className="text-[11px] text-muted">—</span>;
              }
              const official = new Date(`${f.gregorian_date}T12:00:00Z`);
              const celebrationIso = celebrationDateFor(f.gregorian_date);
              const celebration = new Date(`${celebrationIso}T12:00:00Z`);
              const isNext = f.id === nextToCelebrateId;
              return (
                <div>
                  {isNext && (
                    <div className="mb-1.5 inline-block rounded-full bg-[#C4A235]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-dark">
                      ✦ Próxima a celebrar
                    </div>
                  )}
                  <div className="text-[11px] uppercase tracking-wide text-muted">
                    Inicio del mes
                  </div>
                  <div className="text-[12.5px] text-dark">
                    {formatDate(official)}
                  </div>
                  <div className="mt-1.5 text-[11px] uppercase tracking-wide text-terra">
                    Celebración
                  </div>
                  <div className="text-[12.5px] font-semibold text-terra">
                    {formatDate(celebration)} al atardecer
                  </div>
                </div>
              );
            },
          },
          {
            key: "status",
            label: "Estado",
            width: "140px",
            render: (f) => <StatusBadge status={f.status} />,
          },
          {
            key: "participants",
            label: "Participantes",
            width: "130px",
            render: (f) => {
              if (f.locations_count === 0) {
                return <span className="text-[11px] text-muted">—</span>;
              }
              if (f.participants_total === null) {
                return (
                  <span className="text-[11px] italic text-muted">
                    Sin registrar
                  </span>
                );
              }
              return (
                <div>
                  <div className="font-display text-[18px] font-semibold text-dark">
                    {f.participants_total}
                  </div>
                  {f.locations_with_data < f.locations_count && (
                    <div className="text-[10px] text-muted">
                      {f.locations_with_data} de {f.locations_count} lugares
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "actions",
            label: "",
            width: "180px",
            render: (f) => (
              <div className="flex items-center justify-end gap-3">
                <Link
                  href={`/admin/fiestas/${f.id}/sugerencias`}
                  className="text-[12px] font-semibold text-amber hover:underline"
                >
                  Captura
                </Link>
                <Link
                  href={`/admin/fiestas/${f.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

function StatusBadge({ status }: { status: FeastStatus }) {
  if (status === "in_progress") {
    return (
      <span className="rounded bg-[#C4A235]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-dark">
        Iniciada
      </span>
    );
  }
  if (status === "published") {
    return (
      <span className="rounded bg-terra/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terra">
        Publicada
      </span>
    );
  }
  return (
    <span className="rounded bg-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
      No publicada
    </span>
  );
}

function formatDate(d: Date): string {
  const weekday = WEEKDAYS_ES[d.getUTCDay()];
  const day = d.getUTCDate();
  const month = MONTHS_ES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${weekday} ${day} de ${month} ${year}`;
}
