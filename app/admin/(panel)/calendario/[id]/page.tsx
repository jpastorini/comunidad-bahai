import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { getLocalityAvailability } from "@/lib/availability-data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isStructureLocality, type CalendarEvent } from "@/lib/types";
import { AvailabilityMini } from "../AvailabilityMini";
import { EventAvailabilityAside } from "../EventAvailabilityAside";
import { EventForm } from "../event-form";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requirePermission("calendario");
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const event = data as CalendarEvent;
  // Un evento que una estructura compartió con la comunidad (085) se ve
  // en el calendario de la Asamblea, pero lo edita la estructura.
  if (event.locality_id && event.locality_id !== session.locality.id) notFound();
  const structure = isStructureLocality(session.locality);
  // La disponibilidad de la Asamblea es suya: un ayudante (088) no la ve.
  const availability =
    session.profile.role === "admin"
      ? await getLocalityAvailability(session.locality.id)
      : null;

  return (
    <div className="mx-auto max-w-3xl xl:flex xl:max-w-none xl:items-start xl:gap-6">
      <div className="min-w-0 xl:max-w-3xl xl:flex-1">
        <PageHeader back={{ href: "/admin/calendario", label: "Calendario" }} eyebrow={structure ? "Agenda" : "Vida comunitaria"} title="Editar evento" />
        <EventForm event={event} structure={structure} />
      </div>
      {availability && (
        <EventAvailabilityAside
          initialKind={event.kind ?? "actividad_general"}
          className="hidden xl:sticky xl:top-6 xl:block xl:w-[340px] xl:shrink-0"
        >
          <AvailabilityMini data={availability} />
        </EventAvailabilityAside>
      )}
    </div>
  );
}
