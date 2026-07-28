import { PageHeader } from "@/components/admin/ui";
import { requirePanelAccess } from "@/lib/auth";
import { compileBulletinCandidates } from "@/lib/bulletins";
import { saveBulletinAction } from "../actions";
import { BulletinEditor } from "../editor";

export default async function NuevoBoletinPage() {
  const session = await requirePanelAccess();
  const candidates = await compileBulletinCandidates(session.locality.id);

  const defaultTitle = `Boletín de ${session.locality.name}`;

  return (
    <>
      <PageHeader
        eyebrow="Boletín local"
        title="Nueva edición"
        description="Elegí qué incluir: el contenido sale de lo que ya está cargado en la app."
      />
      <BulletinEditor
        candidates={candidates}
        defaultTitle={defaultTitle}
        action={saveBulletinAction}
      />
    </>
  );
}
