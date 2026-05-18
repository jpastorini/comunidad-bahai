import { FormShell, PageHeader } from "@/components/admin/ui";
import { MessageForm } from "../message-form";

export default function NewMessagePage() {
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
