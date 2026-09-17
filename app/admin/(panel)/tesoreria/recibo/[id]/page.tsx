import { notFound } from "next/navigation";
import { Banner, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { receiptAssets } from "@/lib/receipt-assets";
import { getReceiptSettings } from "@/lib/receipt-settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatReceiptDate, receiptLocalityName } from "@/lib/treasury-format";
import {
  getEntryForReceipt,
  getReceiptLegal,
  receiptDisplayName,
} from "@/lib/treasury-ledger";
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

  const [entry, legal] = await Promise.all([
    getEntryForReceipt(supabase, params.id),
    getReceiptLegal(supabase, session.locality.id),
  ]);
  if (!entry) notFound();

  // La firma, el tema y el nombre que va impreso (060). El nombre lo
  // resuelve la base con la MISMA función que usa la copia del creyente:
  // hasta la 060 esta pantalla imprimía el nombre de quien la tuviera
  // abierta, así que las dos caras del papel podían no coincidir. La
  // fecha del asiento decide el ejercicio, o sea que un recibo del 183
  // reimpreso hoy sale con el tesorero del 183.
  const receipt = await getReceiptSettings(supabase, session.locality.id, {
    entryDate: entry.entry_date,
    issuedBy: entry.receipt_issued_by,
  });

  const { hasLogo } = receiptAssets();
  const voided = Boolean(entry.voided_at);

  const destination = [entry.subcategory_name, entry.fund_name]
    .filter(Boolean)
    .join(" — ");

  return (
    <>
      <PageHeader back={{ href: "/admin/tesoreria/libro", label: "Libro" }}
        eyebrow="Tesorería"
        title={`Recibo N.° ${entry.receipt_number ?? "—"}`}
        description="Se imprime en A5, igual que el de la planilla."
      />

      {voided && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>Recibo anulado.</strong> El número queda ocupado en la serie
            y el aporte no suma en ningún saldo.
            {entry.void_reason ? ` Motivo: ${entry.void_reason}` : ""}
          </Banner>
        </div>
      )}

      {entry.amount < 0 && (
        <div className="mb-4">
          <Banner tone="info">
            Este movimiento es un gasto. Los recibos se emiten para
            contribuciones recibidas.
          </Banner>
        </div>
      )}

      {!legal.rut && (
        <div className="mb-4">
          <Banner tone="info">
            El recibo sale sin RUT ni domicilio fiscal. Cargalos en{" "}
            <strong>Asamblea → Datos de la Asamblea</strong> y van a aparecer en
            todos los recibos.
          </Banner>
        </div>
      )}

      {!receipt.ready && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>Falta aplicar la migración 060.</strong> Mientras tanto el
            recibo sale terracota y con el nombre de quien lo tenga abierto,
            como hasta ahora.
          </Banner>
        </div>
      )}

      {receipt.ready && !receipt.signerName && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>El recibo va a salir sin nombre bajo la firma.</strong> No
            hay Tesorero/a declarado en Datos de la Asamblea, ni nadie con el
            tag de Tesorería en esta comunidad. Cargalo donde corresponda o
            escribilo en <strong>Tesorería → Recibo</strong>.
          </Banner>
        </div>
      )}

      {receipt.ready && !receipt.signatureUrl && (
        <div className="mb-4">
          <Banner tone="info">
            El recibo sale sin firma. Subí la del Tesorero/a en{" "}
            <strong>Tesorería → Recibo</strong>; ahí también se elige el color.
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

      {/* `treasurerName`: sin la 060 no existe la función que resuelve el
          firmante, así que se mantiene lo que había (el nombre de quien
          tiene la pantalla abierta) para no dejar el renglón en blanco. */}
      <ReceiptView
        id={entry.id}
        receiptNumber={entry.receipt_number}
        dateLabel={formatReceiptDate(entry.entry_date)}
        contributor={receiptDisplayName(entry)}
        currency={entry.currency}
        amount={Math.abs(entry.amount)}
        destination={destination || "—"}
        localityName={receiptLocalityName(session.locality.name)}
        treasurerName={
          receipt.signerName ?? (receipt.ready ? "" : session.profile.full_name ?? "")
        }
        treasurerTitle={receipt.settings?.treasurer_title}
        issued={entry.receipt_issued}
        hasLogo={hasLogo}
        signatureUrl={receipt.signatureUrl}
        theme={receipt.settings?.theme}
        legal={legal}
        voided={voided}
      />
    </>
  );
}
