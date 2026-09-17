import { notFound } from "next/navigation";
import { GoldHeader } from "@/components/GoldHeader";
import { requireBahai } from "@/lib/auth";
import { getMyReceipt } from "@/lib/my-contributions";
import { receiptAssets } from "@/lib/receipt-assets";
import { loadSignatureImage } from "@/lib/receipt-settings";
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
  const session = await requireBahai(`/perfil/aportes/recibo/${params.id}`);
  const supabase = createSupabaseServer();

  const receipt = await getMyReceipt(supabase, params.id);
  if (!receipt) notFound();

  const { hasLogo } = receiptAssets();
  // El bucket de firmas es privado; la RLS (060) deja leerlo a cualquier
  // autenticado a propósito, porque el recibo puede ser de otra
  // comunidad (un aporte al Fondo Nacional).
  const signatureUrl = await loadSignatureImage(supabase, receipt.signature_path);
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
          treasurerTitle={receipt.treasurer_title}
          hasLogo={hasLogo}
          signatureUrl={signatureUrl}
          theme={receipt.theme}
          legal={{
            registeredName: receipt.registered_name ?? null,
            rut: receipt.rut ?? null,
            address: receipt.fiscal_address ?? null,
          }}
          voided={Boolean(receipt.voided_at)}
        />
      </main>
    </>
  );
}
