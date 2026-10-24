import Link from "next/link";
import { redirect } from "next/navigation";
import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { StatusChip } from "@/components/admin/StructureReportView";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getOwnStructureReports } from "@/lib/structure-reports";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getAdminReports } from "@/lib/treasury-reports";
import { isStructureLocality } from "@/lib/types";
import { presentTreasuryReportAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Informes a la Asamblea (084): lo que una estructura le presenta a la
 * Asamblea que la creó. Es lo único de la estructura que la Asamblea ve:
 * ni el libro, ni las actas, ni las tareas (decidido con el usuario).
 */
export default async function PresentarPage() {
  const session = await requireAdmin();
  if (!isStructureLocality(session.locality)) redirect("/admin/informes");
  const supabase = createSupabaseServer();
  const isTreasurer = !!session.profile.can_manage_treasury;

  const [{ reports, schemaMissing }, treasuryReports] = await Promise.all([
    getOwnStructureReports(supabase, session.locality.id),
    isTreasurer ? getAdminReports(supabase, session.locality.id) : Promise.resolve([]),
  ]);
  const presentedTreasury = new Set(reports.map((r) => r.treasury_report_id).filter(Boolean));
  const toPresent = treasuryReports.filter(
    (r) => r.status === "published" && !presentedTreasury.has(r.id)
  );

  return (
    <>
      <PageHeader
        eyebrow="Reuniones y tareas"
        title="Informes a la Asamblea"
        description="Lo que la estructura le presenta a la Asamblea que la creó: informes de actividad y de Tesorería. La Asamblea los ve en su Registro de informes y registra en qué reunión los aprobó; lo demás de la estructura no lo ve."
        actions={
          <Button href="/admin/presentar/nuevo" disabled={schemaMissing}>
            + Informe de actividad
          </Button>
        }
      />

      {schemaMissing && (
        <div className="mb-5">
          <Banner tone="warning">
            Falta aplicar la migración 084 en la base. Hasta entonces no se pueden
            presentar informes.
          </Banner>
        </div>
      )}

      <Card>
        {reports.length === 0 ? (
          <p className="text-[13px] text-muted">Todavía no hay informes.</p>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/presentar/${r.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 hover:text-terra"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {r.kind === "tesoreria" ? "Tesorería" : "Actividad"}
                      {r.period_to && ` · hasta el ${formatDate(r.period_to)}`}
                    </span>
                    <span className="block font-display text-[16px] font-semibold text-dark">
                      {r.title}
                    </span>
                  </span>
                  <StatusChip report={r} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isTreasurer && !schemaMissing && (
        <Card className="mt-4">
          <h2 className="font-display text-[18px] font-semibold text-dark">
            Presentar un informe de Tesorería
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Las hojas emitidas en Tesorería → Informes. La Asamblea lee la hoja tal cual,
            sin acceso al libro.
          </p>
          {toPresent.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              No hay informes emitidos sin presentar.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-black/[0.05]">
              {toPresent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 text-[13.5px] font-medium text-dark">
                    {r.title}
                    <span className="ml-2 text-[12px] text-muted">
                      {formatDate(r.period_from)} al {formatDate(r.period_to)}
                    </span>
                  </span>
                  <form action={presentTreasuryReportAction}>
                    <input type="hidden" name="treasury_report_id" value={r.id} />
                    <Button type="submit" variant="secondary">
                      Presentar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
