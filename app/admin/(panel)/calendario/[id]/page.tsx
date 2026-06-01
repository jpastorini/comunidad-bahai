import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getLocalityAvailability } from "@/lib/availability-data";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/types";
import { AvailabilityMini } from "../AvailabilityMini";
import { EventAvailabilityAside } from "../EventAvailabilityAside";
import { EventForm } from "../event-form";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const event = data as CalendarEvent;
  const availability = await getLocalityAvailability(session.locality.id);

  return (
    <div className="mx-auto max-w-3xl xl:flex xl:max-w-none xl:items-start xl:gap-6">
      <div className="min-w-0 xl:max-w-3xl xl:flex-1">
        <PageHeader eyebrow="Calendario" title="Editar evento" />
        <EventForm event={event} />
      </div>
      <EventAvailabilityAside
        initialKind={event.kind ?? "actividad_general"}
        className="hidden xl:sticky xl:top-6 xl:block xl:w-[340px] xl:shrink-0"
      >
        <AvailabilityMini data={availability} />
      </EventAvailabilityAside>
    </div>
  );
}
