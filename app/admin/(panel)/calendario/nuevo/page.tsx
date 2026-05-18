import { FormShell, PageHeader } from "@/components/admin/ui";
import { EventForm } from "../event-form";

export default function NewEventPage() {
  return (
    <FormShell>
      <PageHeader eyebrow="Calendario" title="Nuevo evento" />
      <EventForm />
    </FormShell>
  );
}
