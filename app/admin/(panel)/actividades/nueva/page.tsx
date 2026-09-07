import { FormShell, PageHeader } from "@/components/admin/ui";
import { ActivityForm } from "../activity-form";

export default function NewActivityPage() {
  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/actividades", label: "Actividades" }} eyebrow="Vida comunitaria" title="Nueva actividad" />
      <ActivityForm />
    </FormShell>
  );
}
