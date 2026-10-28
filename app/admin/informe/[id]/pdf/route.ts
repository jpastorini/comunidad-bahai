import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { registerBookletFonts } from "@/components/feast/FeastBooklet";
import { ReportSheetPdf, reportPdfFileName } from "@/components/treasury/ReportSheetPdf";
import { pdfFontSources } from "@/lib/pdf-fonts";
import { loadViewableReport } from "@/lib/treasury-report-view";

/**
 * GET /admin/informe/[id]/pdf → la hoja interna de Tesorería en PDF, para
 * mandarla por WhatsApp a la Asamblea (botón "Enviar por WhatsApp" de la
 * hoja). Generada con react-pdf, sin Chromium.
 *
 * Mismo guard que la página (`loadViewableReport`): rol de Asamblea y la
 * RLS de los informes. Solo la hoja interna: el deck de la comunidad ya
 * tiene su link público y el balance su propia hoja. Lo que salga de acá
 * viaja como archivo y se puede reenviar; por eso la hoja no lleva
 * nombres de contribuyentes, igual que en pantalla.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// react-pdf arranca en frío cargando fuentes y su motor de layout.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const view = await loadViewableReport(params.id);
  if (!view || view.report.audience !== "internos") notFound();
  const { report, emitter, institution, approvedBy, shared } = view;

  registerBookletFonts(pdfFontSources(new URL(req.url).origin));

  const doc = createElement(ReportSheetPdf, {
    report: shared,
    localityName: emitter.name,
    institution,
    approvedBy,
    emittedBy: report.editorial.signature?.name ?? null,
    draft: report.status !== "published",
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(doc);
  const download = new URL(req.url).searchParams.get("descargar") === "1";
  const fileName = reportPdfFileName(report.title);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
