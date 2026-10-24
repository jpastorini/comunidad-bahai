import { Button, DateInput, Field, TextArea, TextInput } from "@/components/admin/ui";
import { UploadingForm } from "@/components/admin/UploadingForm";
import type { StructureReport } from "@/lib/structure-reports";
import { saveActivityReportAction } from "./actions";

/** El borrador de un informe de actividad: texto y, si hace falta, un archivo. */
export function ActivityForm({
  localityId,
  report,
}: {
  localityId: string;
  report?: StructureReport | null;
}) {
  return (
    <UploadingForm
      action={saveActivityReportAction}
      localityId={localityId}
      folder="informes"
      className="flex flex-col gap-4"
    >
      {report && <input type="hidden" name="id" value={report.id} />}
      <Field label="Título" name="title" required>
        <TextInput
          name="title"
          required
          defaultValue={report?.title ?? ""}
          placeholder="Informe de actividades del primer trimestre"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Desde" name="period_from">
          <DateInput name="period_from" defaultValue={report?.period_from ?? ""} />
        </Field>
        <Field label="Hasta" name="period_to">
          <DateInput name="period_to" defaultValue={report?.period_to ?? ""} />
        </Field>
      </div>
      <Field label="Informe" name="body" hint="Qué se hizo, qué se aprendió, qué se le pide a la Asamblea.">
        <TextArea name="body" rows={12} defaultValue={report?.body ?? ""} />
      </Field>
      <Field
        label="Archivo adjunto"
        name="file"
        hint={
          report?.file_name
            ? `Ya tiene «${report.file_name}». Subir otro lo reemplaza. Hasta 20 MB.`
            : "Opcional: un PDF, una planilla o fotos. Hasta 20 MB."
        }
      >
        <input
          type="file"
          name="file"
          className="block w-full text-[13px] text-dark file:mr-3 file:rounded-lg file:border-0 file:bg-terra/10 file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-terra"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit">Guardar borrador</Button>
      </div>
    </UploadingForm>
  );
}
