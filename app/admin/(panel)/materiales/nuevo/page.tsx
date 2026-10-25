import { FormShell, PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { MaterialForm } from "../material-form";

export const revalidate = 60;

export default async function NewMaterialPage() {
  await requirePermission("materiales");
  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/materiales", label: "Materiales" }}
        eyebrow="Vida comunitaria"
        title="Nuevo material"
        description="Material de tu comunidad. Los materiales para todas las localidades se cargan en Admin Nacional → Materiales."
      />
      <MaterialForm />
    </FormShell>
  );
}
