import { Banner, Button, Card, PageHeader, TextInput } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { receiptAssets } from "@/lib/receipt-assets";
import { getReceiptSettings } from "@/lib/receipt-settings";
import { createSupabaseServer } from "@/lib/supabase/server";
import { receiptLocalityName } from "@/lib/treasury-format";
import { getReceiptLegal } from "@/lib/treasury-ledger";
import type { Treasury } from "@/lib/types";
import { savePaymentMethodsAction } from "./actions";
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

  const [data, legal, treasuryRow] = await Promise.all([
    getReceiptSettings(supabase, localityId),
    getReceiptLegal(supabase, localityId),
    // Los medios de pago viven en la tabla `treasury` vieja, una fila por
    // localidad; es lo único que la comunidad sigue leyendo de ahí.
    supabase
      .from("treasury")
      .select("methods")
      .eq("locality_id", localityId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const methods = ((treasuryRow.data as Pick<Treasury, "methods"> | null)?.methods ?? []).concat([
    { type: "", description: "", letter: "" },
  ]);
  const { hasLogo, hasSignature: hasLegacySignature } = receiptAssets();

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Recibo y medios de pago"
        description="Quién firma, con qué firma y de qué color sale el comprobante de contribución; y cómo se aporta, que es lo que la comunidad ve en Tesorería."
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

      <div id="medios-de-pago" />
      <Card className="mb-5">
        <h2 className="font-display text-[20px] font-semibold text-dark">Cómo aportar</h2>
        <p className="mb-4 mt-1 text-[12px] text-muted">
          Las tarjetas con los medios de pago que ve la comunidad en la
          pantalla Tesorería de la app. Una fila por medio: el nombre, los
          datos (cuenta, alias, a nombre de quién) y una letra para el ícono.
          Las filas vacías se ignoran; para agregar más, guardá y volvé a
          abrir.
        </p>
        <form action={savePaymentMethodsAction} className="flex flex-col gap-3">
          {methods.map((m, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[180px,1fr,72px]">
              <TextInput
                name="method_type[]"
                defaultValue={m.type}
                placeholder="Transferencia"
                aria-label="Medio"
              />
              <TextInput
                name="method_description[]"
                defaultValue={m.description}
                placeholder="BROU caja de ahorro 001-123456 · Asamblea Espiritual Local"
                aria-label="Datos"
              />
              <TextInput
                name="method_letter[]"
                defaultValue={m.letter}
                maxLength={1}
                placeholder="T"
                aria-label="Letra"
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button type="submit">Guardar medios de pago</Button>
          </div>
        </form>
      </Card>

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
