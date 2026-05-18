import { FormShell, PageHeader } from "@/components/admin/ui";
import { ActivityForm } from "../activity-form";

export default function NewActivityPage() {
  return (
    <FormShell>
      <PageHeader eyebrow="Comunidad" title="Nueva actividad" />
      <ActivityForm />
    </FormShell>
  );
}
