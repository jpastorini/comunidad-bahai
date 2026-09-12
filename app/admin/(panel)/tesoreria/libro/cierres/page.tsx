import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  buildCashbook,
  monthKeyOf,
  monthKeysBetween,
  summaryTotals,
} from "@/lib/treasury-cashbook";
import {
  closingFor,
  getCashbookEntries,
  getCashbookNames,
  getCloserNames,
  getClosings,
  getFirstEntryMonth,
  lastClosedMonth,
  nextMonthToClose,
} from "@/lib/treasury-closings";
import { todayISO } from "@/lib/treasury-ledger";
import { CierresClient, type MonthRow } from "./cierres-client";

export const dynamic = "force-dynamic";

/**
 * Cierres mensuales del libro (054).
 *
 * Un mes por fila, del primero con movimientos al mes en curso. El
 * tesorero cierra en orden, imprime el Libro de Caja del mes cerrado y lo
 * pega en el libro de tapas duras. El mes en curso se puede imprimir como
 * borrador para revisarlo antes.
 */
export default async function CierresPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const today = todayISO();
  const currentMonth = monthKeyOf(today);

  const [closings, firstMonth, entries, names] = await Promise.all([
    getClosings(supabase),
    getFirstEntryMonth(supabase),
    getCashbookEntries(supabase, currentMonth),
    getCashbookNames(supabase),
  ]);
  const people = await getCloserNames(supabase, closings);

  const months = firstMonth ? monthKeysBetween(firstMonth, currentMonth).reverse() : [];
  const expected = nextMonthToClose(closings, firstMonth, today);
  const reopenable = lastClosedMonth(closings);

  const rows: MonthRow[] = months.map((month) => {
    const book = buildCashbook(entries, month, names);
    const closing = closingFor(closings, month);
    const history = closings.filter(
      (c) => monthKeyOf(c.period_month) === month && c.status === "reopened"
    );
    return {
      month,
      current: month === currentMonth,
      entriesCount: book.entriesCount,
      voidedCount: book.voidedCount,
      totals: summaryTotals(book.summary).map((t) => ({
        currency: t.currency,
        income: t.income,
        expense: t.expense,
        closing: t.closing,
      })),
      closing: closing
        ? {
            at: formatDateTime(closing.closed_at),
            by: closing.closed_by ? people.get(closing.closed_by) ?? null : null,
          }
        : null,
      reopenings: history.map((h) => ({
        at: h.reopened_at ? formatDateTime(h.reopened_at) : "",
        by: h.reopened_by ? people.get(h.reopened_by) ?? null : null,
        reason: h.reopen_reason ?? "",
      })),
      canClose: expected === month,
      canReopen: reopenable === month,
    };
  });

  return (
    <>
      <PageHeader
        back={{ href: "/admin/tesoreria/libro", label: "Libro" }}
        eyebrow="Tesorería"
        title="Cierres mensuales"
        description="Cerrás el mes, imprimís su Libro de Caja y lo pegás en el libro. Un mes cerrado ya no se toca: se corrige con contra-asientos."
        actions={<Button variant="secondary" href="/admin/tesoreria/libro">Ir al libro</Button>}
      />

      <div className="mb-4">
        <Banner tone="info">
          Los cierres son <strong>consecutivos</strong> y por <strong>mes civil</strong>,
          que es el corte que pide el MEC para el Libro Mayor de Caja. Un mes se
          cierra cuando terminó. Solo el último cerrado se puede reabrir, con
          motivo, y queda registrado.
        </Banner>
      </div>

      {months.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-[13px] text-muted">
            El libro está vacío: no hay meses para cerrar.
          </p>
        </Card>
      ) : (
        <CierresClient rows={rows} />
      )}
    </>
  );
}
