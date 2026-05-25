import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteMaterialAction } from "./actions";
import type { StudyMaterial } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  ruhi: "Ruhí",
  libros: "Libro",
  escritos: "Escritos",
  oraciones: "Oraciones",
  oracion_del_mes: "Oración del mes",
};

export default async function AdminMaterialesPage() {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("study_materials")
    .select("*")
    .order("kind", { ascending: true })
    .order("number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as StudyMaterial[];

  return (
    <>
      <PageHeader
        eyebrow="Estudio"
        title="Materiales"
        description="Libros Ruhí, escritos, oraciones y la Oración del mes con imagen para compartir."
        actions={<Button href="/admin/materiales/nuevo">+ Nuevo material</Button>}
      />

      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        empty="Sin materiales todavía."
        columns={[
          {
            key: "kind",
            label: "Tipo",
            width: "150px",
            render: (m) => (
              <span className="rounded bg-bg px-2 py-0.5 text-[11px] font-bold uppercase text-dark">
                {KIND_LABEL[m.kind] ?? m.kind}
              </span>
            ),
          },
          {
            key: "title",
            label: "Título",
            render: (m) => (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-dark">
                    {m.kind === "ruhi" && m.number ? `${m.number}. ` : ""}
                    {m.title}
                  </span>
                  {m.locality_id === null && (
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-dark">
                      Nacional
                    </span>
                  )}
                </div>
                {m.subtitle && (
                  <div className="text-[12px] text-muted">{m.subtitle}</div>
                )}
              </div>
            ),
          },
          {
            key: "attachment",
            label: "Archivo",
            width: "110px",
            render: (m) => {
              if (m.kind === "oracion_del_mes") {
                return m.image_url ? (
                  <a
                    href={m.image_url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 rounded bg-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold-dark hover:bg-gold/25"
                  >
                    IMG
                  </a>
                ) : (
                  <span className="text-[11px] text-muted">—</span>
                );
              }
              return m.pdf_url ? (
                <a
                  href={m.pdf_url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded bg-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gold-dark hover:bg-gold/25"
                >
                  PDF
                </a>
              ) : (
                <span className="text-[11px] text-muted">—</span>
              );
            },
          },
          {
            key: "status",
            label: "Estado",
            width: "120px",
            render: (m) => {
              if (m.kind === "oracion_del_mes") {
                return m.current ? (
                  <span className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber">
                    Actual
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Pasado</span>
                );
              }
              if (m.kind !== "ruhi") return <span className="text-[11px] text-muted">—</span>;
              if (m.current)
                return (
                  <span className="rounded bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber">
                    En curso
                  </span>
                );
              if (m.completed)
                return (
                  <span className="rounded bg-terra/15 px-2 py-0.5 text-[10px] font-bold uppercase text-terra">
                    Completado
                  </span>
                );
              return <span className="text-[11px] text-muted">Pendiente</span>;
            },
          },
          {
            key: "actions",
            label: "",
            width: "150px",
            render: (m) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/materiales/${m.id}`}
                  className="text-[12px] font-semibold text-terra hover:underline"
                >
                  Editar
                </Link>
                <form action={deleteMaterialAction}>
                  <input type="hidden" name="id" value={m.id} />
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
