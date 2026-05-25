import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { MaterialForm } from "../material-form";

export const dynamic = "force-dynamic";

export default async function NewMaterialPage() {
  const session = await requireAdmin();
  return (
    <FormShell>
      <PageHeader eyebrow="Estudio" title="Nuevo material" />
      <MaterialForm canPublishNational={session.profile.is_national_admin} />
    </FormShell>
  );
}
