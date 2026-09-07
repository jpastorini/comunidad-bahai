import { FormShell, PageHeader } from "@/components/admin/ui";
import { NeedForm } from "../need-form";

export default function NewNeedPage() {
  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/servicio", label: "Servicio" }} eyebrow="Vida comunitaria" title="Nueva necesidad" />
      <NeedForm />
    </FormShell>
  );
}
