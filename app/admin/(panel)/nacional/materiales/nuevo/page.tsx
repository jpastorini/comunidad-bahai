import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { MaterialForm } from "../../../materiales/material-form";

export const revalidate = 60;

export default async function NewNacionalMaterialPage() {
  await requireNationalAdmin();
  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/nacional/materiales", label: "Materiales nacionales" }}
        eyebrow="Admin Nacional"
        title="Nuevo material nacional"
        description="Visible para todas las comunidades."
      />
      <MaterialForm national />
    </FormShell>
  );
}
