import { notFound } from "next/navigation";
import { Banner, Button, PageHeader } from "@/components/admin/ui";
import {
  formatReceiptDate,
  receiptLocalityName,
} from "@/components/treasury/ReceiptSheet";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { receiptAssets } from "@/lib/receipt-assets";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getEntryForReceipt, receiptDisplayName } from "@/lib/treasury-ledger";
import { ReceiptView } from "./receipt-view";

export const dynamic = "force-dynamic";

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

  const { hasLogo, hasSignature } = receiptAssets();

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

      {entry.receipt_name && entry.contributor_name && (
        <div className="mb-4">
          <Banner tone="info">
            El recibo figura a nombre de <strong>{entry.receipt_name}</strong>;
            en el libro el aporte es de {entry.contributor_name}.
          </Banner>
        </div>
      )}

      <ReceiptView
        id={entry.id}
        receiptNumber={entry.receipt_number}
        dateLabel={formatReceiptDate(entry.entry_date)}
        contributor={receiptDisplayName(entry)}
        currency={entry.currency}
        amount={Math.abs(entry.amount)}
        destination={destination || "—"}
        localityName={receiptLocalityName(session.locality.name)}
        treasurerName={session.profile.full_name ?? ""}
        issued={entry.receipt_issued}
        hasLogo={hasLogo}
        hasSignature={hasSignature}
      />
    </>
  );
}
