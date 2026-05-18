import { notFound } from "next/navigation";
import { FormShell, PageHeader } from "@/components/admin/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/types";
import { EventForm } from "../event-form";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <FormShell>
      <PageHeader eyebrow="Calendario" title="Editar evento" />
      <EventForm event={data as CalendarEvent} />
    </FormShell>
  );
}
