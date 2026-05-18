import { FormShell, PageHeader } from "@/components/admin/ui";
import { NeedForm } from "../need-form";

export default function NewNeedPage() {
  return (
    <FormShell>
      <PageHeader eyebrow="Servicio" title="Nueva necesidad" />
      <NeedForm />
    </FormShell>
  );
}
