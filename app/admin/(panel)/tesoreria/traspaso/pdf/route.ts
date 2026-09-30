import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { HandoverActPdf } from "@/components/treasury/HandoverActPdf";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getHandoverData } from "@/lib/treasury-handover";
import { todayISO } from "@/lib/treasury-ledger";
import { isISODate } from "@/lib/treasury-ledger-filters";

/**
 * GET /admin/tesoreria/traspaso/pdf?fecha=&entrega=&recibe=&testigo=&notas=
 * → el acta de traspaso en PDF, para imprimir y firmar. Tag de Tesorería.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const p = new URL(req.url).searchParams;
  const asOfRaw = p.get("fecha") ?? "";
  const asOf = isISODate(asOfRaw) && asOfRaw <= todayISO() ? asOfRaw : todayISO();
  const clip = (v: string | null, n: number) => (v ?? "").trim().slice(0, n);

  const data = await getHandoverData(supabase, { localityId: session.locality.id, asOf });
  const doc = createElement(HandoverActPdf, {
    data,
    localityName: session.locality.name,
    outgoing: clip(p.get("entrega"), 120) || session.profile.full_name || "",
    incoming: clip(p.get("recibe"), 120),
    witness: clip(p.get("testigo"), 120),
    notes: clip(p.get("notas"), 2000),
  }) as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Acta-de-traspaso-Tesoreria-${asOf}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
