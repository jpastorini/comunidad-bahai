import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteFeastAction } from "./actions";

type FeastRow = {
  id: string;
  bahai_month_name: string;
  bahai_month_index: number;
  bahai_year: number;
  status: "scheduled" | "in_progress";
  participants_total: number | null;
  locations_count: number;
  locations_with_data: number;
};

export default async function AdminFiestasPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();

  // Trae cada Fiesta con su array de locations (solo el campo necesario).
  const { data } = await supabase
    .from("feasts")
    .select(
      "id, bahai_month_name, bahai_month_index, bahai_year, status, feast_locations(participant_count)"
    )
    .order("bahai_year", { ascending: false })
    .order("bahai_month_index", { ascending: false });

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
      status: f.status as "scheduled" | "in_progress",
      participants_total: withData.length > 0 ? total : null,
      locations_count: locs.length,
      locations_with_data: withData.length,
    };
  });

  // Estadística agregada sobre las últimas 6 Fiestas con datos.
  const withStats = feasts.filter((f) => f.participants_total != null).slice(0, 6);
  const avg =
    withStats.length > 0
      ? Math.round(
          withStats.reduce((s, f) => s + (f.participants_total ?? 0), 0) /
            withStats.length
        )
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Vida comunitaria"
        title="Fiestas de los Diecinueve Días"
        description="Programa, lugares, tesorería del mes, sugerencias y participación."
        actions={<Button href="/admin/fiestas/nueva">+ Nueva Fiesta</Button>}
      />

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
        empty="Aún no hay Fiestas creadas. Crea la primera."
        columns={[
          {
            key: "month",
            label: "Mes",
            render: (f) => (
              <div>
                <div className="font-display text-[15px] font-semibold text-dark">
                  {f.bahai_month_name}
                </div>
                <div className="text-[11px] text-muted">
                  Mes {f.bahai_month_index} · {f.bahai_year} BE
                </div>
              </div>
            ),
          },
          {
            key: "status",
            label: "Estado",
            width: "130px",
            render: (f) =>
              f.status === "in_progress" ? (
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Iniciada
                </span>
              ) : (
                <span className="rounded bg-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  Por iniciar
                </span>
              ),
          },
          {
            key: "participants",
            label: "Participantes",
            width: "150px",
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
            width: "160px",
            render: (f) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/fiestas/${f.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteFeastAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    className="text-[12px] font-semibold text-rose-600 hover:underline"
                  >
                    Borrar
                  </button>
                </form>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
