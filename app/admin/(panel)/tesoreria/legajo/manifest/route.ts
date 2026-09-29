import { NextResponse } from "next/server";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildDossierManifest } from "@/lib/treasury-dossier";
import { isISODate } from "@/lib/treasury-ledger-filters";
import { daysBetween } from "@/lib/treasury-year";

/**
 * GET /admin/tesoreria/legajo/manifest?from=&to= → el manifiesto del
 * legajo: los CSV ya generados y las URL (firmadas, de una hora) de los
 * archivos. El navegador baja y comprime; ver lib/treasury-dossier.ts.
 *
 * Tag de Tesorería, como el libro. El rango se acota a tres años: más
 * que eso son varios legajos, uno por ejercicio.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isISODate(from) || !isISODate(to) || from > to) {
    return NextResponse.json({ error: "El período no es válido." }, { status: 400 });
  }
  if (daysBetween(from, to) > 3 * 366) {
    return NextResponse.json(
      { error: "El período no puede pasar de tres años. Armá un legajo por ejercicio." },
      { status: 400 }
    );
  }

  try {
    const manifest = await buildDossierManifest(createSupabaseServer(), {
      localityId: session.locality.id,
      localityName: session.locality.name,
      localityKind: session.locality.kind ?? "ael",
      from,
      to,
      generatedBy: session.profile.full_name ?? session.user.email ?? "Tesorería",
    });
    return NextResponse.json(manifest, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[legajo/manifest]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo armar el legajo." },
      { status: 500 }
    );
  }
}
