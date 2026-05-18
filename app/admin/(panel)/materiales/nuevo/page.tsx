import { FormShell, PageHeader } from "@/components/admin/ui";
import { MaterialForm } from "../material-form";

export default function NewMaterialPage() {
  return (
    <FormShell>
      <PageHeader eyebrow="Estudio" title="Nuevo material" />
      <MaterialForm />
    </FormShell>
  );
}
