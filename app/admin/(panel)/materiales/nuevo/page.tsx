import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { MaterialForm } from "../material-form";

export const revalidate = 60;

export default async function NewMaterialPage() {
  await requireAdmin();
  return (
    <FormShell>
      <PageHeader
        eyebrow="Estudio"
        title="Nuevo material"
        description="Material de tu comunidad. Los materiales para todas las localidades se cargan en Admin Nacional → Materiales."
      />
      <MaterialForm />
    </FormShell>
  );
}
