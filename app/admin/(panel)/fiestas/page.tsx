import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getFeasts } from "@/lib/data";
import { deleteFeastAction } from "./actions";

export default async function AdminFiestasPage() {
  await requireAdmin();
  const feasts = await getFeasts();

  return (
    <>
      <PageHeader
        eyebrow="Vida comunitaria"
        title="Fiestas de los Diecinueve Días"
        description="Programa, lugares, tesorería del mes y sugerencias de los miembros."
        actions={<Button href="/admin/fiestas/nueva">+ Nueva Fiesta</Button>}
      />
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
            width: "140px",
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
