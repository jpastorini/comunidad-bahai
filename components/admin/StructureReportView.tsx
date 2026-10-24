import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import type { StructureReport } from "@/lib/structure-reports";
import { STRUCTURE_TYPE_LABELS } from "@/lib/types";

/**
 * Un informe presentado por una estructura (084), tal como lo leen la
 * estructura y la Asamblea a la que se presentó: la misma pieza en las dos
 * pantallas, así nadie ve una versión distinta.
 */
export function StructureReportView({
  report,
  fileUrl,
}: {
  report: StructureReport;
  fileUrl: string | null;
}) {
  const period =
    report.period_from && report.period_to
      ? `${formatDate(report.period_from)} al ${formatDate(report.period_to)}`
      : report.period_from
        ? `Desde el ${formatDate(report.period_from)}`
        : report.period_to
          ? `Hasta el ${formatDate(report.period_to)}`
          : null;
  const structureLabel = report.structure
    ? `${report.structure.structure_type ? STRUCTURE_TYPE_LABELS[report.structure.structure_type] : "Estructura"} · ${report.structure.name}`
    : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold-dark">
            {report.kind === "tesoreria" ? "Informe de Tesorería" : "Informe de actividad"}
            {structureLabel && ` · ${structureLabel}`}
          </div>
          <h2 className="mt-1 font-display text-[22px] font-semibold leading-tight text-dark">
            {report.title}
          </h2>
          {period && <p className="mt-0.5 text-[12.5px] text-muted">{period}</p>}
        </div>
        <StatusChip report={report} />
      </div>

      {report.body && (
        <div className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-dark">
          {report.body}
        </div>
      )}

      {(fileUrl || report.kind === "tesoreria") && (
        <div className="mt-5 flex flex-wrap gap-2">
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="tap rounded-xl border border-black/10 bg-card px-4 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
            >
              Abrir {report.file_name ?? "el archivo"}
            </a>
          )}
          {report.kind === "tesoreria" && report.treasury_report_id && (
            <Link
              href={`/admin/informe/${report.treasury_report_id}`}
              className="tap rounded-xl border border-black/10 bg-card px-4 py-2 text-[13px] font-semibold text-dark hover:bg-bg"
            >
              Abrir la hoja de Tesorería
            </Link>
          )}
        </div>
      )}

      {report.approved_on && (
        <p className="mt-5 border-t border-black/[0.06] pt-3 text-[13px] text-dark">
          Aprobado por la Asamblea en su reunión del{" "}
          <strong>{formatDate(report.approved_on)}</strong>
          {report.approval_note && ` · ${report.approval_note}`}
        </p>
      )}
    </Card>
  );
}

export function StatusChip({ report }: { report: StructureReport }) {
  const [label, cls] = report.approved_on
    ? [`Aprobado el ${formatDate(report.approved_on)}`, "bg-[#6A8B5F1A] text-[#4F6B46]"]
    : report.status === "presentado"
      ? [
          `Presentado${report.presented_at ? ` el ${formatDate(report.presented_at)}` : ""}`,
          "bg-[#B7791F1A] text-[#8A5A12]",
        ]
      : ["Borrador", "bg-black/[0.05] text-muted"];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
