import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { ShareBulletinButton } from "@/components/ShareBulletinButton";
import { requirePanelAccess } from "@/lib/auth";
import { compileBulletinCandidates, getBulletin } from "@/lib/bulletins";
import { saveBulletinAction } from "../actions";
import { BulletinEditor } from "../editor";

export default async function EditarBoletinPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requirePanelAccess();
  const [bulletin, candidates] = await Promise.all([
    getBulletin(params.id),
    compileBulletinCandidates(session.locality.id),
  ]);

  if (!bulletin || bulletin.locality_id !== session.locality.id) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Boletín local"
        title={bulletin.status === "published" ? "Editar edición publicada" : "Editar borrador"}
        description={
          bulletin.status === "published"
            ? "Los cambios se ven al guardar. No se vuelve a notificar a los creyentes."
            : "El borrador no es visible para los creyentes hasta que lo publiques."
        }
        actions={
          bulletin.status === "published" ? (
            <ShareBulletinButton
              token={bulletin.share_token}
              title={bulletin.title}
            />
          ) : undefined
        }
      />
      <BulletinEditor
        candidates={candidates}
        defaultTitle={bulletin.title}
        bulletin={{
          id: bulletin.id,
          status: bulletin.status,
          title: bulletin.title,
          editorial: bulletin.editorial,
          content: bulletin.content,
        }}
        action={saveBulletinAction}
      />
    </>
  );
}
