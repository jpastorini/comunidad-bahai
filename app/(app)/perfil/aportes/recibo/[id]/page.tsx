import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireMember } from "@/lib/auth";
import { getMyReceipt } from "@/lib/my-contributions";
import { receiptAssets } from "@/lib/receipt-assets";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatReceiptDate, receiptLocalityName } from "@/lib/treasury-format";
import { MyReceiptView } from "./my-receipt-view";

export const dynamic = "force-dynamic";

/**
 * La copia del recibo para el creyente. Es la MISMA hoja A5 que emite el
 * tesorero (`ReceiptSheet`); los datos salen de `my_receipt()` (046), que
 * solo devuelve un aporte vinculado al perfil de quien pregunta.
 */
export default async function MiReciboPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireMember(`/perfil/aportes/recibo/${params.id}`);
  const supabase = createSupabaseServer();

  const receipt = await getMyReceipt(supabase, params.id);
  if (!receipt) notFound();

  const { hasLogo, hasSignature } = receiptAssets();
  const destination = [receipt.subcategory_name, receipt.fund_name]
    .filter(Boolean)
    .join(" — ");

  return (
    <>
      <GoldHeader
        title={`Recibo N.° ${receipt.receipt_number ?? "—"}`}
        subtitle={receipt.locality_name ?? session.locality.name}
        backHref="/perfil/aportes"
        backLabel="Mis aportes"
      />
      <main className="scroll-area flex-1 px-4 pb-6 pt-4">
        <MyReceiptView
          receiptNumber={receipt.receipt_number}
          dateLabel={formatReceiptDate(receipt.entry_date)}
          contributor={
            receipt.receipt_name?.trim() || receipt.contributor_name || "(sin nombre)"
          }
          currency={receipt.currency}
          amount={Math.abs(receipt.amount)}
          destination={destination || "—"}
          localityName={receiptLocalityName(
            receipt.locality_name ?? session.locality.name
          )}
          treasurerName={receipt.treasurer_name ?? ""}
          hasLogo={hasLogo}
          hasSignature={hasSignature}
        />
      </main>
    </>
  );
}
