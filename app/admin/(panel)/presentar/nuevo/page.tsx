import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { isStructureLocality } from "@/lib/types";
import { ActivityForm } from "../activity-form";

export default async function NuevoInformeActividadPage() {
  const session = await requireAdmin();
  if (!isStructureLocality(session.locality)) redirect("/admin/informes");

  return (
    <>
      <PageHeader
        eyebrow="Reuniones y tareas"
        title="Nuevo informe de actividad"
        description="Se guarda como borrador; la Asamblea lo ve recién cuando lo presentás."
        back={{ href: "/admin/presentar", label: "Informes a la Asamblea" }}
      />
      <Card>
        <ActivityForm localityId={session.locality.id} />
      </Card>
    </>
  );
}
