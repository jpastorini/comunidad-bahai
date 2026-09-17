import { FormShell, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { isNationalLocality } from "@/lib/types";
import { ComunicadoForm } from "../comunicado-form";

export default async function NewComunicadoPage() {
  const session = await requireAdmin();
  const national = isNationalLocality(session.locality);

  return (
    <FormShell>
      <PageHeader back={{ href: "/admin/comunicados", label: "Comunicados" }}
        eyebrow="Comunicación"
        title={national ? "Nuevo comunicado nacional" : "Nuevo comunicado"}
        description={
          national
            ? "Un comunicado de la Asamblea Nacional, para toda la comunidad del país."
            : "Comparte un comunicado oficial con la comunidad."
        }
      />
      <ComunicadoForm national={national} />
    </FormShell>
  );
}
