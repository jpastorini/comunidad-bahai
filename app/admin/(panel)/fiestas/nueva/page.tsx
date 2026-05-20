import { PageHeader } from "@/components/admin/ui";
import { FeastForm } from "../feast-form";

export default function NewFeastPage() {
  return (
    <>
      <PageHeader
        eyebrow="Vida comunitaria"
        title="Nueva Fiesta de los Diecinueve Días"
        description="Crea la Fiesta indicando el mes bahá'í y los lugares. Después podrás cargar la plantilla de oraciones y completar el programa."
      />
      <FeastForm />
    </>
  );
}
