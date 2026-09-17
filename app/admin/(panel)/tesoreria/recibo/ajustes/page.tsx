import { Banner, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { receiptAssets } from "@/lib/receipt-assets";
import { getReceiptSettings } from "@/lib/receipt-settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import { receiptLocalityName } from "@/lib/treasury-format";
import { getReceiptLegal } from "@/lib/treasury-ledger";
import { ReceiptSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

/**
 * Los ajustes del recibo (060): quién firma, con qué imagen y en qué
 * color. Vive en Tesorería y no en Datos de la Asamblea porque quien
 * tiene el PNG de la firma es el tesorero, y porque la RLS de la ficha
 * legal es admin-only a propósito.
 *
 * El NOMBRE que se imprime no se decide acá salvo que alguien lo escriba:
 * sale del Tesorero/a declarado en la composición de la Asamblea (052).
 * Un campo propio sería el mismo dato en dos lados.
 */
export default async function AjustesReciboPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();
  const localityId = session.locality.id;

  const [data, legal] = await Promise.all([
    getReceiptSettings(supabase, localityId),
    getReceiptLegal(supabase, localityId),
  ]);
  const { hasLogo, hasSignature: hasLegacySignature } = receiptAssets();

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Recibo"
        description="Quién firma, con qué firma y de qué color sale el comprobante de contribución."
      />

      {!data.ready && (
        <div className="mb-4">
          <Banner tone="warning">
            <strong>Falta aplicar la migración 060.</strong> Hasta entonces el
            recibo sigue saliendo terracota y sin firma propia de esta
            comunidad, y acá no se puede guardar nada.
          </Banner>
        </div>
      )}

      {data.ready && !data.signerName && (
        <div className="mb-4">
          <Banner tone="info">
            Nadie figura como Tesorero/a. Cargá la composición en{" "}
            <strong>Asamblea → Datos de la Asamblea</strong> —así el nombre se
            mantiene solo cada Riḍván— o escribilo acá abajo.
          </Banner>
        </div>
      )}

      <Card>
        <ReceiptSettingsForm
          settings={data.settings}
          ready={data.ready}
          localityId={localityId}
          localityName={receiptLocalityName(session.locality.name)}
          signatureUrl={data.signatureUrl}
          signerName={data.signerName}
          legal={legal}
          hasLogo={hasLogo}
          hasLegacySignature={hasLegacySignature}
          updatedLabel={
            data.settings?.updated_at
              ? `Actualizado ${formatDateTime(data.settings.updated_at)}`
              : "Todavía sin ajustes propios."
          }
        />
      </Card>
    </>
  );
}
