import { InvitationEditor } from "@/components/invitations/InvitationEditor";
import { PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { invitationFooter } from "@/lib/invitation";
import { isStructureLocality } from "@/lib/types";
import { createEventFromInvitationAction } from "../actions";

// Creador de invitaciones, empezando por la invitación: se piden los
// datos, sale la imagen y de ahí nace la actividad del calendario. Para
// quien piensa "tengo que invitar" antes que "tengo que cargar un evento".
// El diseño con AI (un server action de esta pantalla) tarda cerca de un
// minuto: sin esto la función se corta antes.
export const maxDuration = 120;

export default async function NewInvitationPage({
  searchParams,
}: {
  searchParams: { fecha?: string };
}) {
  const session = await requirePermission("calendario");
  const structure = isStructureLocality(session.locality);
  const fecha = searchParams?.fecha;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/calendario", label: "Calendario" }}
        eyebrow={structure ? "Agenda" : "Vida comunitaria"}
        title="Crear invitación"
        description="Completá los datos: se arma la imagen para compartir por WhatsApp y la actividad queda creada en el calendario."
      />
      <InvitationEditor
        create={{ action: createEventFromInvitationAction, structure }}
        initial={{
          eyebrow: "Te invitamos",
          title: "",
          date: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "",
          time: "",
          place: "",
          text: "",
          footer: invitationFooter(session.locality),
          imageUrl: null,
        }}
      />
    </>
  );
}
