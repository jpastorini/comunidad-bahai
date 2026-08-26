import { existsSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { Banner, Button, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getEntryForReceipt } from "@/lib/treasury-ledger";
import { ReceiptView } from "./receipt-view";

export const dynamic = "force-dynamic";

/** "2026-08-22" → "22/08/2026", sin pasar por Date (no hay huso que corra). */
function formatReceiptDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function ReciboPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const entry = await getEntryForReceipt(supabase, params.id);
  if (!entry) notFound();

  // El logo y la firma son opcionales: si todavía no se cargaron los
  // archivos, el recibo se emite igual (ver scripts/extract-recibo-assets.mjs).
  const publicDir = path.join(process.cwd(), "public", "recibo");
  const hasLogo = existsSync(path.join(publicDir, "logo.png"));
  const hasSignature = existsSync(path.join(publicDir, "firma.png"));

  const destination = [entry.subcategory_name, entry.fund_name]
    .filter(Boolean)
    .join(" — ");

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title={`Recibo N.° ${entry.receipt_number ?? "—"}`}
        description="Se imprime en A5, igual que el de la planilla."
        actions={<Button href="/admin/tesoreria/libro">Volver al libro</Button>}
      />

      {entry.amount < 0 && (
        <div className="mb-4">
          <Banner tone="info">
            Este movimiento es un gasto. Los recibos se emiten para
            contribuciones recibidas.
          </Banner>
        </div>
      )}

      {!hasLogo && !hasSignature && (
        <div className="mb-4">
          <Banner tone="info">
            Falta cargar el logo y la firma en <code>public/recibo/</code>. El
            recibo se emite igual, sin esas imágenes.
          </Banner>
        </div>
      )}

      <ReceiptView
        id={entry.id}
        receiptNumber={entry.receipt_number}
        dateLabel={formatReceiptDate(entry.entry_date)}
        contributor={entry.contributor_name ?? "(sin nombre)"}
        currency={entry.currency}
        amount={Math.abs(entry.amount)}
        destination={destination || "—"}
        localityName={session.locality.name.replace(/^Comunidad Bahá'í de\s*/i, "")}
        treasurerName={session.profile.full_name ?? ""}
        issued={entry.receipt_issued}
        hasLogo={hasLogo}
        hasSignature={hasSignature}
      />
    </>
  );
}
