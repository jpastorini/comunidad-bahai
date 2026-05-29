import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { ActaImporter } from "./importer";

export default async function ImportarActaPage() {
  await requireAdmin();
  return (
    <FormShell>
      <PageHeader
        eyebrow="Tareas de la Asamblea"
        title="Importar acta"
        description="Subí el acta de la reunión en Word (.docx). Claude lee el texto y propone las tareas que surgieron de la consulta; vos las revisás y confirmás. El archivo no se guarda, solo el texto se procesa."
      />
      <ActaImporter />
    </FormShell>
  );
}
