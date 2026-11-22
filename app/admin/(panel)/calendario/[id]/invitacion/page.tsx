import { notFound } from "next/navigation";
import { InvitationEditor } from "@/components/invitations/InvitationEditor";
import { PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { to24h } from "@/lib/format";
import { invitationFooter, shortText } from "@/lib/invitation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isStructureLocality, type CalendarEvent } from "@/lib/types";

// Creador de invitaciones: la imagen de un evento del calendario para
// compartir por WhatsApp. La usa la Asamblea y quien tenga encargado el
// Calendario (088), igual que el alta del evento.
// El diseño con AI (un server action de esta pantalla) tarda cerca de un
// minuto: sin esto la función se corta antes.
export const maxDuration = 120;

export default async function EventInvitationPage({
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
  // Lo de otra institución (085) lo invita quien lo cargó.
  if (event.locality_id && event.locality_id !== session.locality.id) notFound();

  const date = `${event.year}-${String(event.month).padStart(2, "0")}-${String(event.day).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        back={{ href: `/admin/calendario/${event.id}`, label: "Evento" }}
        eyebrow={isStructureLocality(session.locality) ? "Agenda" : "Vida comunitaria"}
        title="Invitación"
        description="Una imagen con los datos del evento, lista para compartir por WhatsApp."
      />
      <InvitationEditor
        initial={{
          eyebrow: event.is_system_seeded ? "Día Sagrado" : "Te invitamos",
          title: event.title,
          date,
          time: to24h(event.time ?? "") ?? "",
          place: event.location ?? "",
          text: shortText(event.description),
          footer: invitationFooter(session.locality),
          imageUrl: event.image_url ?? null,
        }}
      />
    </>
  );
}
