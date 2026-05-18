import { FormShell, PageHeader } from "@/components/admin/ui";
import { ComunicadoForm } from "../comunicado-form";

export default function NewComunicadoPage() {
  return (
    <FormShell>
      <PageHeader
        eyebrow="Asamblea Espiritual Local"
        title="Nuevo comunicado"
        description="Comparte un comunicado oficial con la comunidad."
      />
      <ComunicadoForm />
    </FormShell>
  );
}
