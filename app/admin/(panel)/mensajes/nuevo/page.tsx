import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireNationalAdmin } from "@/lib/auth";
import { MessageForm } from "../message-form";

export const revalidate = 60;

export default async function NewMessagePage() {
  await requireNationalAdmin();
  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/mensajes", label: "Mensajes de la Casa Universal" }}
        eyebrow="Admin Nacional"
        title="Nuevo mensaje"
        description="Sube el PDF oficial. Los creyentes lo verán en la sección Mensajes."
      />
      <MessageForm />
    </FormShell>
  );
}
