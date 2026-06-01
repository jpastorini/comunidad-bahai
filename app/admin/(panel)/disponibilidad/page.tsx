import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import {
  getLocalityAvailability,
  getMyAvailability,
} from "@/lib/availability-data";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { AvailabilityHeatmap } from "./AvailabilityHeatmap";

export const revalidate = 0;

type View = "mia" | "equipo";

export default async function DisponibilidadPage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const session = await requireAdmin();
  const view: View = searchParams.v === "equipo" ? "equipo" : "mia";

  return (
    <>
      <PageHeader
        eyebrow="Asamblea"
        title="Disponibilidad para reuniones"
        description="Marcá en qué franjas de la semana podés reunirte. El consolidado del equipo ayuda a la Secretaría a elegir el mejor horario."
        actions={
          <div className="inline-flex rounded-xl border border-black/10 bg-card p-1">
            <Tab href="/admin/disponibilidad?v=mia" active={view === "mia"}>
              Mi disponibilidad
            </Tab>
            <Tab href="/admin/disponibilidad?v=equipo" active={view === "equipo"}>
              Consolidado
            </Tab>
          </div>
        }
      />

      {view === "mia" ? (
        <div className="max-w-xl">
          <AvailabilityEditor initial={await getMyAvailability(session.user.id)} />
        </div>
      ) : (
        <AvailabilityHeatmap
          data={await getLocalityAvailability(session.locality.id)}
        />
      )}
    </>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
        active ? "bg-terra text-white shadow-card-soft" : "text-dark hover:bg-bg"
      }`}
    >
      {children}
    </Link>
  );
}
