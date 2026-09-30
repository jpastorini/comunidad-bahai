import { Banner, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getContributorsOverview } from "@/lib/treasury-contributors";
import { TREASURY_HELP } from "@/lib/treasury-help";
import { getLedgerCatalog } from "@/lib/treasury-ledger";
import { isNationalLocality } from "@/lib/types";
import { ContributorsClient } from "./contributors-client";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Contribuyentes (075): el padrón de quienes aportan, para
 * dejarlo prolijo: vincular cada ficha a su creyente, fusionar los
 * duplicados y sacar del buscador lo que no se usa. Es lo que hace que
 * «Mis aportes» y Compromisos digan la verdad.
 */
export default async function ContribuyentesPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const catalog = await getLedgerCatalog(supabase, session.locality.id, {
    nationwide: isNationalLocality(session.locality),
  });
  const rows = await getContributorsOverview(supabase, catalog.members);

  const unlinked = rows.filter((r) => r.is_active && !r.profile_id && r.kind !== "colecta").length;
  const withLookalikes = rows.filter((r) => r.is_active && r.lookalikes.length > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        help={TREASURY_HELP.screens.contribuyentes}
        title="Contribuyentes"
        description="Quiénes aportan, según el libro. Vinculá cada ficha a su creyente, fusioná las que son la misma persona y desactivá las que ya no se usan."
      />

      {(unlinked > 0 || withLookalikes > 0) && (
        <div className="mb-4">
          <Banner tone="info">
            {unlinked > 0 && (
              <>
                <strong>{unlinked}</strong> {unlinked === 1 ? "ficha sin vincular" : "fichas sin vincular"} a un
                creyente: sus aportes no aparecen en «Mis aportes» ni cuentan en Compromisos.{" "}
              </>
            )}
            {withLookalikes > 0 && (
              <>
                <strong>{withLookalikes}</strong> {withLookalikes === 1 ? "ficha parece" : "fichas parecen"} tener
                un doble.
              </>
            )}
          </Banner>
        </div>
      )}

      <ContributorsClient rows={rows} members={catalog.members} />
    </>
  );
}
