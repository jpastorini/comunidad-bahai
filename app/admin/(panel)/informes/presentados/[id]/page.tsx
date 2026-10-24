import { notFound } from "next/navigation";
import { Button, Card, DateInput, Field, PageHeader, TextInput } from "@/components/admin/ui";
import { StructureReportView } from "@/components/admin/StructureReportView";
import { requireAdmin } from "@/lib/auth";
import { getStructureReport, signInstitutionFile } from "@/lib/structure-reports";
import { createSupabaseServer } from "@/lib/supabase/server";
import { reviewStructureReportAction } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * Un informe que le presentó a esta Asamblea una de sus estructuras (084).
 * La RLS decide si existe: la Asamblea madre ve solo lo presentado.
 */
export default async function InformePresentadoPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const report = await getStructureReport(supabase, params.id);
  if (!report || report.parent_id !== session.locality.id || report.status !== "presentado") {
    notFound();
  }
  const fileUrl = await signInstitutionFile(supabase, report.file_path);

  return (
    <>
      <PageHeader
        eyebrow="Asamblea"
        title={report.title}
        description={
          report.structure
            ? `Presentado por ${report.structure.name}. La Asamblea registra acá en qué reunión lo aprobó.`
            : undefined
        }
        back={{ href: "/admin/informes", label: "Registro de informes" }}
      />

      <StructureReportView report={report} fileUrl={fileUrl} />

      <Card className="mt-4">
        <h2 className="font-display text-[18px] font-semibold text-dark">Aprobación</h2>
        <form action={reviewStructureReportAction} className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="id" value={report.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Aprobado en la reunión del"
              name="approved_on"
              hint="Dejala vacía para quitar la aprobación."
            >
              <DateInput name="approved_on" defaultValue={report.approved_on ?? ""} />
            </Field>
            <Field label="Acta u observación" name="approval_note">
              <TextInput
                name="approval_note"
                defaultValue={report.approval_note ?? ""}
                placeholder="Acta N.º 12"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
