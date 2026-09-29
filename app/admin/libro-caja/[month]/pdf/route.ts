import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { CashBookPdf } from "@/components/treasury/CashBookPdf";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  buildCashbook,
  isValidMonthKey,
  monthRange,
} from "@/lib/treasury-cashbook";
import {
  closingFor,
  getCashbookEntries,
  getCashbookNames,
  getCloserNames,
  getClosings,
} from "@/lib/treasury-closings";
import { getReceiptLegal } from "@/lib/treasury-ledger";
import { treasuryYearForDate } from "@/lib/treasury-year";

/**
 * GET /admin/libro-caja/[month]/pdf → el Libro Mayor de Caja de ese mes
 * en PDF, generado con react-pdf (Node puro, sin Chromium). Es lo que el
 * legajo del auditor mete en la carpeta 02-libro-de-caja, un archivo por
 * mes; también sirve suelto, con `?descargar=1` para bajarlo en vez de
 * abrirlo.
 *
 * Mismo guard y los mismos datos que la página imprimible
 * (/admin/libro-caja/[month]): tag de Tesorería, RLS de la localidad,
 * `buildCashbook` sobre todo el libro hasta el fin del mes.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: { month: string } }) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  if (!isValidMonthKey(params.month)) notFound();
  const month = params.month;
  const supabase = createSupabaseServer();

  const [entries, names, closings, legal] = await Promise.all([
    getCashbookEntries(supabase, month),
    getCashbookNames(supabase),
    getClosings(supabase),
    getReceiptLegal(supabase, session.locality.id),
  ]);

  const book = buildCashbook(entries, month, names);
  const closing = closingFor(closings, month);
  const closerNames = closing ? await getCloserNames(supabase, [closing]) : new Map<string, string>();

  const doc = createElement(CashBookPdf, {
    book,
    localityName: session.locality.name,
    legal,
    closing: closing
      ? {
          closedAt: closing.closed_at,
          closedBy: closing.closed_by ? closerNames.get(closing.closed_by) ?? null : null,
        }
      : null,
    bahaiYear: treasuryYearForDate(monthRange(month).to),
  }) as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(doc);
  const download = new URL(req.url).searchParams.get("descargar") === "1";
  const fileName = `Libro-de-Caja-${month}${closing ? "" : "-BORRADOR"}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
