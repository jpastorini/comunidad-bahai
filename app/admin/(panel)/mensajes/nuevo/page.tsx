import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { MessageForm } from "../message-form";

export const dynamic = "force-dynamic";

export default async function NewMessagePage() {
  await requireNationalAdmin();
  return (
    <FormShell>
      <PageHeader
        eyebrow="Casa Universal de Justicia"
        title="Nuevo mensaje"
        description="Sube el PDF oficial. Los miembros lo verán en la sección Mensajes."
      />
      <MessageForm />
    </FormShell>
  );
}
