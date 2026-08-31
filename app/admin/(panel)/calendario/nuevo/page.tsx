import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getLocalityAvailability } from "@/lib/availability-data";
import { AvailabilityMini } from "../AvailabilityMini";
import { EventAvailabilityAside } from "../EventAvailabilityAside";
import { EventForm } from "../event-form";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { fecha?: string };
}) {
  const session = await requireAdmin();
  const availability = await getLocalityAvailability(session.locality.id);

  // Fecha prellenada al llegar desde el "+" de un día en la vista Mes.
  const fecha = searchParams?.fecha;
  const defaultDate =
    fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : undefined;

  return (
    <div className="mx-auto max-w-3xl xl:flex xl:max-w-none xl:items-start xl:gap-6">
      <div className="min-w-0 xl:max-w-3xl xl:flex-1">
        <PageHeader eyebrow="Calendario" title="Nuevo evento" />
        <EventForm defaultDate={defaultDate} />
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
