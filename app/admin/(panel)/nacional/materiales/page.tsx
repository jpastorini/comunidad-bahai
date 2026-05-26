import Link from "next/link";
import { Button, DataTable, PageHeader } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { StudyMaterial } from "@/lib/types";
import { deleteMaterialAction } from "../../materiales/actions";

export const revalidate = 60;

const KIND_LABEL: Record<string, string> = {
  ruhi: "Ruhí",
  libros: "Libro",
  escritos: "Escritos",
  oraciones: "Oraciones",
  oracion_del_mes: "Oración del mes",
};

export default async function AdminNacionalMaterialesPage() {
  await requireNationalAdmin();
  const supabase = createSupabaseServer();
  // Solo materiales NACIONALES (locality_id NULL) — visibles a todas.
  const { data } = await supabase
    .from("study_materials")
    .select("*")
    .is("locality_id", null)
    .order("kind", { ascending: true })
    .order("number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as StudyMaterial[];

  return (
    <>
      <PageHeader
        eyebrow="Admin Nacional"
        title="Materiales (nacionales)"
        description="Libros Ruhí, Escritos y Libros para TODAS las comunidades. Lo que cargues acá lo ven todas las localidades."
        actions={
          <Button href="/admin/nacional/materiales/nuevo">
            + Nuevo material
          </Button>
        }
      />

      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        empty="Aún no hay materiales nacionales."
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
                <div className="text-[14px] font-semibold text-dark">
                  {m.kind === "ruhi" && m.number ? `${m.number}. ` : ""}
                  {m.title}
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
            render: (m) =>
              m.pdf_url ? (
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
              ),
          },
          {
            key: "actions",
            label: "",
            width: "150px",
            render: (m) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/admin/nacional/materiales/${m.id}`}
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
