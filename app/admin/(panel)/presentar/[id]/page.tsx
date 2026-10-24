import { notFound, redirect } from "next/navigation";
import { Button, Card, PageHeader } from "@/components/admin/ui";
import { StructureReportView } from "@/components/admin/StructureReportView";
import { requireAdmin } from "@/lib/auth";
import { getStructureReport, signInstitutionFile } from "@/lib/structure-reports";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isStructureLocality } from "@/lib/types";
import { ActivityForm } from "../activity-form";
import { deleteReportAction, presentReportAction, withdrawReportAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Un informe de la estructura. Borrador: se edita y se presenta.
 * Presentado: se lee como lo lee la Asamblea, y se puede retirar mientras
 * no lo hayan aprobado.
 */
export default async function InformeEstructuraPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!isStructureLocality(session.locality)) redirect(`/admin/informes/presentados/${params.id}`);
  const supabase = createSupabaseServer();
  const report = await getStructureReport(supabase, params.id);
  if (!report || report.structure_id !== session.locality.id) notFound();
  const fileUrl = await signInstitutionFile(supabase, report.file_path);
  const draft = report.status === "borrador";

  return (
    <>
      <PageHeader
        eyebrow="Reuniones y tareas"
        title={draft ? "Borrador del informe" : report.title}
        back={{ href: "/admin/presentar", label: "Informes a la Asamblea" }}
      />

      {draft ? (
        <>
          <Card>
            <ActivityForm localityId={session.locality.id} report={report} />
          </Card>
          <Card className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                {fileUrl ? (
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-terra hover:underline">
                    Ver {report.file_name ?? "el archivo"}
                  </a>
                ) : (
                  "Sin archivo adjunto."
                )}{" "}
                Al presentarlo, la Asamblea recibe un aviso. Guardá los cambios antes.
              </p>
              <div className="flex gap-2">
                <form action={deleteReportAction}>
                  <input type="hidden" name="id" value={report.id} />
                  <Button type="submit" variant="ghost">
                    Eliminar borrador
                  </Button>
                </form>
                <form action={presentReportAction}>
                  <input type="hidden" name="id" value={report.id} />
                  <Button type="submit">Presentar a la Asamblea</Button>
                </form>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <>
          <StructureReportView report={report} fileUrl={fileUrl} />
          {!report.approved_on && (
            <form action={withdrawReportAction} className="mt-4 flex justify-end">
              <input type="hidden" name="id" value={report.id} />
              <Button type="submit" variant="secondary">
                {report.kind === "tesoreria" ? "Retirar la presentación" : "Retirar y volver a borrador"}
              </Button>
            </form>
          )}
        </>
      )}
    </>
  );
}
