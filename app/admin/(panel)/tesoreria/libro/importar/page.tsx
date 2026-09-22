import { PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getLedgerYears } from "@/lib/treasury-ledger";
import { getLedgerImports } from "@/lib/treasury-imports";
import { treasuryYearForDate } from "@/lib/treasury-year";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

/**
 * Tesorería → Libro → Importar: cargar un ejercicio entero desde la
 * planilla con que se llevaba antes (062).
 *
 * El orden de trabajo es del más viejo al más nuevo. No es una manía: el
 * Libro de Caja acumula todo lo anterior al mes, así que la apertura la
 * trae un solo ejercicio —el primero— y del segundo en adelante el
 * "Saldo anterior" de la planilla sirve para VERIFICAR que el año
 * anterior entró completo. Importando al revés esa verificación no
 * existe y un descuadre aparece al final sin saber de qué año viene.
 */
export default async function ImportarLibroPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const [years, imports] = await Promise.all([
    getLedgerYears(supabase),
    getLedgerImports(supabase),
  ]);

  const currentYear = treasuryYearForDate(new Date().toISOString().slice(0, 10)) ?? 183;
  // El ejercicio que se propone: el anterior al más viejo que ya esté en
  // el libro, que es el siguiente paso de la secuencia.
  const suggested = years.length > 0 ? Math.min(...years) - 1 : currentYear;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Importar un ejercicio"
        description="Cargá al libro un año entero desde la planilla con que se llevaba antes. Primero ves qué entra; nada se guarda hasta que confirmes."
        back={{ href: "/admin/tesoreria/libro", label: "Libro" }}
      />
      <ImportClient
        suggestedYear={suggested}
        ledgerYears={years}
        imports={imports.rows}
        migrationMissing={imports.missing}
      />
    </>
  );
}
