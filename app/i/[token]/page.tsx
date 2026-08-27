import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDeck } from "@/components/treasury/ReportDeck";
import { fmtLongDate } from "@/lib/treasury-report-content";
import { getPublicReport } from "@/lib/treasury-reports";

/**
 * Página PÚBLICA (sin login): el link del informe de Tesorería que la
 * Asamblea reenvía por WhatsApp. Se resuelve por share_token con la
 * service-role key y solo existe para informes publicados.
 *
 * No lleva nombres de contribuyentes: el detalle de ingresos es por
 * número de recibo, fecha y monto.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const res = await getPublicReport(params.token);
  if (!res) return { title: "Informe de Tesorería" };
  const { report, localityName } = res;
  return {
    title: `${report.title} — Informe de Tesorería · ${localityName}`,
    description: `Período del ${fmtLongDate(report.period_from)} al ${fmtLongDate(
      report.period_to
    )}.`,
  };
}

export default async function PublicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const res = await getPublicReport(params.token);
  if (!res) notFound();
  const { report, localityName } = res;

  return (
    <ReportDeck
      report={{
        title: report.title,
        subtitle: report.subtitle,
        periodFrom: report.period_from,
        periodTo: report.period_to,
        snapshot: report.snapshot,
        editorial: report.editorial,
      }}
      localityName={localityName}
    />
  );
}
