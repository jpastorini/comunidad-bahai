import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getLocalityAvailability } from "@/lib/availability-data";
import { AvailabilityMini } from "../AvailabilityMini";
import { EventAvailabilityAside } from "../EventAvailabilityAside";
import { EventForm } from "../event-form";

export default async function NewEventPage() {
  const session = await requireAdmin();
  const availability = await getLocalityAvailability(session.locality.id);

  return (
    <div className="mx-auto max-w-3xl xl:flex xl:max-w-none xl:items-start xl:gap-6">
      <div className="min-w-0 xl:max-w-3xl xl:flex-1">
        <PageHeader eyebrow="Calendario" title="Nuevo evento" />
        <EventForm />
      </div>
      <EventAvailabilityAside
        initialKind="actividad_general"
        className="hidden xl:sticky xl:top-6 xl:block xl:w-[340px] xl:shrink-0"
      >
        <AvailabilityMini data={availability} />
      </EventAvailabilityAside>
    </div>
  );
}
