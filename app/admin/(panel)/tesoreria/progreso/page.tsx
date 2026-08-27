import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { ProgressBoard } from "@/components/treasury/ProgressBoard";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/treasury-ledger";
import { getTreasuryProgress } from "@/lib/treasury-progress";
import { treasuryYearForDate, treasuryYearStart } from "@/lib/treasury-year";

/**
 * Tablero de progreso para el tesorero y la Asamblea.
 *
 * Los números salen de la misma función security definer que alimenta la
 * pantalla de la comunidad, así que las dos dicen exactamente lo mismo.
 */
export const dynamic = "force-dynamic";

export default async function ProgresoPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const today = todayISO();
  const requested = parseInt(searchParams.year ?? "", 10);
  const year = Number.isFinite(requested)
    ? requested
    : treasuryYearForDate(today);

  const data = year
    ? await getTreasuryProgress(supabase, {
        localityId: session.locality.id,
        asOf: today,
        bahaiYear: year,
      })
    : null;

  const previous = year ? year - 1 : null;
  const hasPrevious = previous ? Boolean(treasuryYearStart(previous)) : false;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Progreso del ejercicio"
        description="Cómo viene el año contra el presupuesto y contra las metas. El ejercicio va de Riḍván a Riḍván."
        actions={
          <>
            <Button href="/admin/tesoreria/metas">Editar metas</Button>
            <Button variant="secondary" href="/admin/tesoreria/presupuesto">
              Presupuesto
            </Button>
          </>
        }
      />

      {!data ? (
        <Card>
          <p className="py-6 text-center text-[13px] text-muted">
            No hay datos para el ejercicio {year ?? "actual"}. Puede ser que el
            calendario bahá'í del proyecto no tenga cargado ese año, o que el
            libro esté vacío.
          </p>
        </Card>
      ) : (
        <>
          <ProgressBoard data={data} localityName={session.locality.name} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            {hasPrevious && previous ? (
              <Button
                variant="secondary"
                href={`/admin/tesoreria/progreso?year=${previous}`}
              >
                ← Ejercicio {previous}
              </Button>
            ) : (
              <span />
            )}
            {year && year < (treasuryYearForDate(today) ?? year) && (
              <Button
                variant="secondary"
                href={`/admin/tesoreria/progreso?year=${year + 1}`}
              >
                Ejercicio {year + 1} →
              </Button>
            )}
          </div>

          <div className="mt-5">
            <Banner tone="info">
              Este tablero es el mismo que ven los creyentes en la sección
              Tesorería de la app. No muestra ningún nombre: los totales salen
              de una función que solo devuelve agregados.
            </Banner>
          </div>
        </>
      )}
    </>
  );
}
