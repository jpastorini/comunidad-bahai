import { notFound } from "next/navigation";
import { Button, PageHeader } from "@/components/admin/ui";
import { ShareReportButton } from "@/components/treasury/ShareReportButton";
import { currentAssemblyYear, getAssemblyData, officerOf } from "@/lib/assembly";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/treasury-ledger";
import { fmtDayMonth } from "@/lib/treasury-report-content";
import { getReport } from "@/lib/treasury-reports";
import { saveReportAction } from "../actions";
import { ReportEditor } from "./report-editor";

export const dynamic = "force-dynamic";

export default async function EditarInformePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const report = await getReport(supabase, params.id);
  if (!report || report.locality_id !== session.locality.id) notFound();

  // Las firmas del balance se proponen desde la composición de la
  // Asamblea del ejercicio (052). Si no está cargada, quedan vacías.
  let signerDefaults: { coordinator: string; secretary: string; treasurer: string } | undefined;
  if (report.audience === "balance") {
    const assembly = await getAssemblyData(
      supabase,
      session.locality.id,
      report.bahai_year ?? currentAssemblyYear()
    );
    const term = assembly.term ?? assembly.previousTerm;
    signerDefaults = {
      coordinator: officerOf(term, "coordinador")?.display_name ?? "",
      secretary: officerOf(term, "secretario")?.display_name ?? "",
      treasurer:
        officerOf(term, "tesorero")?.display_name ?? session.profile.full_name ?? "",
    };
  }

  return (
    <>
      <PageHeader back={{ href: "/admin/tesoreria/informes", label: "Informes" }}
        eyebrow="Tesorería · Informe"
        title={report.title}
        description={`${fmtDayMonth(report.period_from)} al ${fmtDayMonth(
          report.period_to
        )}${report.bahai_year ? ` · ${report.bahai_year} E.B.` : ""}`}
        actions={
          <>
            {/* El link público es solo del informe de comunidad: el
                interno se pasa por la ruta del panel. */}
            {report.status === "published" && report.audience === "comunidad" && (
              <ShareReportButton token={report.share_token} title={report.title} />
            )}
            <Button variant="secondary" href={`/admin/informe/${report.id}`}>
              {report.audience === "comunidad" ? "Ver deck" : "Ver hoja"}
            </Button>
          </>
        }
      />

      <ReportEditor
        id={report.id}
        title={report.title}
        subtitle={report.subtitle}
        audience={report.audience}
        periodFrom={report.period_from}
        periodTo={report.period_to}
        status={report.status}
        snapshot={report.snapshot}
        editorial={report.editorial}
        today={todayISO()}
        saveAction={saveReportAction}
        signerDefaults={signerDefaults}
      />
    </>
  );
}
