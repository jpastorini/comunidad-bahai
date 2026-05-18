import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatActivityWhen } from "@/lib/format";
import { deleteActivityAction } from "./actions";
import type { Activity } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  estudio: "Estudio",
  devocional: "Devocional",
  ninos: "Niños",
  jovenes: "Jóvenes",
};

export default async function AdminActividadesPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("*")
    .order("starts_at", { ascending: false });

  const rows = (data ?? []) as Activity[];

  return (
    <>
      <PageHeader
        eyebrow="Comunidad"
        title="Actividades"
        description="Círculos, devocionales, clases de niños y grupos de prejuniors."
        actions={<Button href="/admin/actividades/nueva">+ Nueva actividad</Button>}
      />

      <DataTable
        rows={rows}
        rowKey={(a) => a.id}
        empty="No hay actividades. Programa la primera."
        columns={[
          {
            key: "type",
            label: "Tipo",
            width: "120px",
            render: (a) => (
              <span className="rounded bg-bg px-2 py-0.5 text-[11px] font-bold uppercase text-dark">
                {TYPE_LABEL[a.type] ?? a.type}
              </span>
            ),
          },
          {
            key: "title",
            label: "Actividad",
            render: (a) => (
              <div>
                <div className="text-[14px] font-semibold text-dark">{a.title}</div>
                <div className="text-[12px] text-muted">{a.detail}</div>
              </div>
            ),
          },
          {
            key: "when",
            label: "Cuándo",
            width: "180px",
            render: (a) => {
              const w = formatActivityWhen(a.starts_at);
              return (
                <div className="text-[12px] text-dark">
                  {w.fullLabel}
                  <div className="text-[11px] text-muted">
                    {w.time} · {a.place}
                  </div>
                </div>
              );
            },
          },
          {
            key: "actions",
            label: "",
            width: "150px",
            render: (a) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/actividades/${a.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteActivityAction}>
                  <input type="hidden" name="id" value={a.id} />
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
