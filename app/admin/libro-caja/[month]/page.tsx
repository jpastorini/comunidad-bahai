import Link from "next/link";
import { notFound } from "next/navigation";
import { CashBookSheet } from "@/components/treasury/CashBookSheet";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  buildCashbook,
  isValidMonthKey,
  monthLabel,
  monthRange,
  snapshotMismatches,
} from "@/lib/treasury-cashbook";
import {
  closingFor,
  getCashbookEntries,
  getCashbookNames,
  getCloserNames,
  getClosings,
} from "@/lib/treasury-closings";
import { getReceiptLegal } from "@/lib/treasury-ledger";
import { treasuryYearForDate } from "@/lib/treasury-year";

/**
 * El Libro Mayor de Caja de un mes, a pantalla completa para imprimir.
 *
 * Vive FUERA del grupo (panel) por la misma razón que /admin/informe/[id]:
 * el shell del admin estorba en el papel. Exige el tag de Tesorería: es
 * el libro, no un informe.
 *
 * Sobre un mes cerrado imprime en limpio; sobre uno abierto imprime con
 * marca de BORRADOR, para revisar antes de cerrar.
 */
export const dynamic = "force-dynamic";

export default async function LibroCajaPage({
  params,
}: {
  params: { month: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  if (!isValidMonthKey(params.month)) notFound();
  const month = params.month;
  const supabase = createSupabaseServer();

  const [entries, names, closings, legal] = await Promise.all([
    getCashbookEntries(supabase, month),
    getCashbookNames(supabase),
    getClosings(supabase),
    getReceiptLegal(supabase, session.locality.id),
  ]);

  const book = buildCashbook(entries, month, names);
  const closing = closingFor(closings, month);
  const closerNames = closing ? await getCloserNames(supabase, [closing]) : new Map();
  const mismatches = closing ? snapshotMismatches(book, closing.snapshot) : [];

  return (
    <div className="min-h-dvh bg-bg px-4 py-6 sm:px-8">
      <div className="cb-noprint mx-auto mb-3 flex max-w-[820px] items-center justify-between gap-3 text-[12.5px]">
        <Link
          href="/admin/tesoreria/libro/cierres"
          className="font-semibold text-terra hover:underline"
        >
          ← Volver a los cierres
        </Link>
        <span className="text-muted">
          {monthLabel(month)} · {closing ? "mes cerrado" : "mes abierto (borrador)"}
        </span>
      </div>
      <CashBookSheet
        book={book}
        localityName={session.locality.name}
        legal={legal}
        closing={
          closing
            ? {
                closedAt: closing.closed_at,
                closedBy: closing.closed_by ? closerNames.get(closing.closed_by) ?? null : null,
              }
            : null
        }
        mismatches={mismatches}
        bahaiYear={treasuryYearForDate(monthRange(month).to)}
      />
    </div>
  );
}
