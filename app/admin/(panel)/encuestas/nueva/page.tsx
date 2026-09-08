import { FormShell, PageHeader } from "@/components/admin/ui";
import { EncuestaForm } from "../encuesta-form";

export default function NuevaEncuestaPage() {
  return (
    <FormShell>
      <PageHeader
        back={{ href: "/admin/encuestas", label: "Encuestas" }}
        eyebrow="Comunicación"
        title="Nueva encuesta"
        description="Una pregunta, de 2 a 10 opciones. Al publicarla sale el aviso a quienes pueden votar."
      />
      <EncuestaForm />
    </FormShell>
  );
}
