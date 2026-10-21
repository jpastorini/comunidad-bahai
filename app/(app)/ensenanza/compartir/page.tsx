import { ShareQr, type ShareItem } from "@/components/ensenanza/ShareQr";
import { GoldHeader } from "@/components/GoldHeader";
import { ENSENANZA_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getFriendsInvitePath } from "@/lib/invites";
import { LA_FE_LINKS } from "@/lib/la-fe";

/**
 * Enseñanza → Compartir: los QR para una charla sobre la Fe. El de la app
 * es el link de invitación para Amigos de la Fe de ESTA comunidad (047):
 * quien lo abre queda incorporado solo, sin elegir localidad, y la
 * Asamblea recibe el aviso de alguien nuevo. El del folleto lleva la
 * comunidad para que el formulario de contacto venga prefijado.
 */
export default async function CompartirPage() {
  const session = await requireMember("/ensenanza/compartir");
  const invitePath = await getFriendsInvitePath(session.locality.id);

  const items: ShareItem[] = [
    {
      key: "folleto",
      label: "La Fe",
      title: "Qué es la Fe Bahá'í",
      description: "El folleto para leer en el celular, sin instalar nada.",
      path: `/la-fe?c=${session.locality.id}`,
      shareText: "Te comparto una introducción breve a la Fe Bahá'í:",
    },
    {
      key: "bahai-uy",
      label: "bahai.uy",
      title: "bahai.uy",
      description: "El sitio de la comunidad bahá'í del Uruguay.",
      url: LA_FE_LINKS.bahaiUy,
      shareText: "La comunidad bahá'í del Uruguay:",
    },
    {
      key: "bahai-org",
      label: "bahai.org/es",
      title: "bahai.org/es",
      description: "El sitio internacional, con los Escritos completos en español.",
      url: LA_FE_LINKS.bahaiOrg,
      shareText: "El sitio internacional de la Fe Bahá'í:",
    },
    ...(invitePath
      ? [
          {
            key: "app",
            label: "La app",
            title: "Instalar la app",
            description: `Quien lo abre entra como Amigo/a de la Fe de ${session.locality.name}, sin trámite.`,
            path: invitePath,
            shareText: `Sumate a la app de la Comunidad Bahá'í de ${session.locality.name}:`,
          } satisfies ShareItem,
        ]
      : []),
  ];

  return (
    <>
      <GoldHeader title="Enseñanza" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={ENSENANZA_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pb-4 pt-1">
        <ShareQr items={items} />
      </main>
    </>
  );
}
