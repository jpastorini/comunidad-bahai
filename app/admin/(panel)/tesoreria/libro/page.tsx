import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isNationalLocality } from "@/lib/types";
import { getAttachmentCounts } from "@/lib/treasury-attachments";
import { closedMonthKeys, getClosings } from "@/lib/treasury-closings";
import { formatMoney } from "@/lib/treasury-format";
import { getReconciledEntryIds } from "@/lib/treasury-statements";
import { treasuryYearForDate } from "@/lib/treasury-year";
import {
  formatRangeLabel,
  isISODate,
  parseFocusIds,
} from "@/lib/treasury-ledger-filters";
import {
  balancesBy,
  getLedgerCatalog,
  getLedgerEntries,
  getLedgerEntriesByIds,
  getLedgerEntriesByRange,
  getLedgerYears,
  periodTotals,
  todayISO,
} from "@/lib/treasury-ledger";
import { LedgerClient } from "./ledger-client";

export const dynamic = "force-dynamic";

export default async function LibroTesoreriaPage({
  searchParams,
}: {
  searchParams: { year?: string; from?: string; to?: string; ids?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const years = await getLedgerYears(supabase);
  const requested = parseInt(searchParams.year ?? "", 10);
  const year = Number.isFinite(requested)
    ? requested
    : (years[0] ?? new Date().getUTCFullYear() - 1843);

  // El rango de fechas manda sobre el año: un extracto no sabe de años
  // bahá'ís y puede cruzar el corte de Riḍván. Solo se toma si las dos
  // puntas son fechas válidas y están en orden; cualquier otra cosa cae
  // al libro del año, que es el encuadre de siempre.
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const range =
    isISODate(from) && isISODate(to) && from <= to ? { from, to } : null;

  // Y por encima de los dos manda una lista de movimientos señalados
  // (`?ids=`), que es como la Auditoría trae al tesorero hasta el
  // asiento del que habla un hallazgo. No es un encuadre del libro sino
  // una consulta puntual: por eso arriba no se dibujan saldos (unos
  // pocos movimientos sueltos no tienen saldo que mostrar) y si es uno
  // solo se abre su ficha directamente.
  const focusIds = parseFocusIds(searchParams.ids);
  const focusing = focusIds.length > 0;

  const [catalog, entries, receiptResult, attachmentCounts, closings, reconciled] =
    await Promise.all([
      getLedgerCatalog(supabase, session.locality.id, {
        nationwide: isNationalLocality(session.locality),
      }),
      focusing
        ? getLedgerEntriesByIds(supabase, focusIds)
        : range
          ? getLedgerEntriesByRange(supabase, range.from, range.to)
          : getLedgerEntries(supabase, year),
      supabase.rpc("next_receipt_number", { loc: session.locality.id }),
      getAttachmentCounts(supabase),
      getClosings(supabase),
      getReconciledEntryIds(supabase),
    ]);
  const closedMonths = closedMonthKeys(closings);

  const accountNames = new Map(catalog.accounts.map((a) => [a.id, a.name]));
  const fundNames = new Map(catalog.funds.map((f) => [f.id, f.name]));

  const byAccount = balancesBy(entries, "account_id", accountNames);
  const byFund = balancesBy(entries, "fund_id", fundNames, "Sin fondo");
  const totals = periodTotals(entries);

  const nextReceipt = Number(receiptResult.data) || 1;
  const catalogEmpty = catalog.accounts.length === 0;

  // Con un rango, las tarjetas de arriba NO son saldos: son la variación
  // del período. Un saldo no tiene período —es todo el libro hasta una
  // fecha— y llamar "saldo" a la suma de un mes suelto sería el peor
  // error posible en la pantalla que se usa justamente para cuadrar.
  const scopeLabel = focusing
    ? "movimientos señalados"
    : range
      ? formatRangeLabel(range.from, range.to)
      : `${year} E.B.`;
  const balancesTitle = range ? "Movimiento del período por" : "Saldo por";
  // El ejercicio del alta sale de la fecha del movimiento; esto es solo
  // el valor de respaldo cuando esa fecha no cae en ningún ejercicio.
  const formYear = focusing
    ? (treasuryYearForDate(entries[0]?.entry_date ?? "") ?? year)
    : range
      ? (treasuryYearForDate(range.to) ?? year)
      : year;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title={
          focusing
            ? entries.length === 1
              ? "Libro · un movimiento"
              : `Libro · ${entries.length} movimientos`
            : range
              ? `Libro · ${scopeLabel}`
              : `Libro ${year} E.B.`
        }
        description={
          focusing
            ? "Los movimientos señalados desde otra pantalla, no un encuadre del libro: por eso arriba no se muestran saldos."
            : range
              ? "Movimientos del período elegido, sin importar a qué ejercicio pertenezcan."
              : "Cada línea es un movimiento. El saldo se calcula solo."
        }
        actions={
          <>
            <Button variant="secondary" href="/admin/tesoreria/conciliacion">
              Conciliación
            </Button>
            <Button variant="secondary" href="/admin/tesoreria/libro/cierres">
              Cierres
            </Button>
            <Button href="/admin/tesoreria/informes">Informes</Button>
          </>
        }
      />

      {catalogEmpty ? (
        <Banner tone="info">
          Todavía no hay cuentas cargadas. Aplicá la migración 040 y el archivo
          seed_tesoreria_183.sql en el SQL Editor de Supabase para traer el
          catálogo y los movimientos de la planilla.
        </Banner>
      ) : (
        <>
          {/* Con movimientos señalados no se dibujan saldos: sumar unos
              pocos asientos sueltos daría una cifra que no es el saldo de
              nada y que alguien podría copiar a un informe. */}
          {!focusing && (
            <>
          {/* Saldos: primero por cuenta, que es la plata donde está. */}
          <Card className="mb-4">
            <h2 className="mb-3 font-display text-[18px] font-semibold text-dark">
              {balancesTitle} cuenta
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {byAccount.map((b) => (
                <div
                  key={b.key}
                  className="rounded-xl border border-black/[0.06] bg-bg/40 px-3 py-2.5"
                >
                  <div className="truncate text-[11px] text-muted">{b.label}</div>
                  <div
                    className={`tabular-nums text-[15px] font-semibold ${
                      b.amount < 0 ? "text-rose-700" : "text-dark"
                    }`}
                  >
                    {formatMoney(b.amount)}
                    <span className="ml-1 text-[11px] font-normal text-muted">
                      {b.currency}
                    </span>
                  </div>
                </div>
              ))}
              {byAccount.length === 0 && (
                <p className="text-[12.5px] text-muted">
                  Sin movimientos en {range ? "este período" : "este año"}.
                </p>
              )}
            </div>
          </Card>

          {/* Saldos por fondo: la misma plata, "coloreada" por destino. */}
          <Card className="mb-4">
            <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
              {balancesTitle} fondo
            </h2>
            <p className="mb-3 text-[12px] text-muted">
              Es la misma plata de arriba, agrupada por el fondo al que
              pertenece. Los fondos no se mezclan entre sí ni entre monedas.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {byFund.map((b) => (
                <div
                  key={b.key}
                  className="rounded-xl border border-black/[0.06] bg-bg/40 px-3 py-2.5"
                >
                  <div className="truncate text-[11px] text-muted">{b.label}</div>
                  <div
                    className={`tabular-nums text-[15px] font-semibold ${
                      b.amount < 0 ? "text-rose-700" : "text-dark"
                    }`}
                  >
                    {formatMoney(b.amount)}
                    <span className="ml-1 text-[11px] font-normal text-muted">
                      {b.currency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Movimiento del año: ingresos y gastos reales del Fondo. El
              arrastre del año anterior y las transferencias entre cuentas
              van en su propia línea, porque no son ni ingreso ni gasto. */}
          {totals.length > 0 && (
            <Card className="mb-5">
              <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
                {range ? "Movimiento del período" : "Movimiento del año"}
              </h2>
              <p className="mb-3 text-[12px] text-muted">
                Los cambios de caja y las compras de divisas no cuentan como
                ingreso ni como gasto: mueven la plata de lugar. Van aparte,
                como movimientos internos.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {totals.map((t) => (
                  <div
                    key={t.currency}
                    className="rounded-xl border border-black/[0.06] px-3 py-2.5"
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {t.currency}
                    </div>
                    {/* El "saldo anterior" es el arrastre del ejercicio, así
                        que solo significa algo cuando se está mirando un
                        ejercicio entero. En un rango se omite, junto con el
                        saldo que se derivaría de él. */}
                    {!range && <Row label="Saldo anterior" value={t.opening} />}
                    <Row label="Ingresos" value={t.income} tone="income" />
                    <Row label="Gastos" value={t.expense} tone="expense" />
                    {t.internalCount > 0 && (
                      <Row
                        label={`Movimientos internos (${t.internalCount})`}
                        value={t.internal}
                      />
                    )}
                    <div className="mt-1 border-t border-black/[0.06] pt-1">
                      <Row
                        label={range ? "Neto del período" : "Saldo actual"}
                        value={
                          range
                            ? Math.round((t.income + t.expense) * 100) / 100
                            : Math.round(
                                (t.opening + t.income + t.expense + t.internal) *
                                  100
                              ) / 100
                        }
                        strong
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
            </>
          )}

          <LedgerClient
            catalog={catalog}
            entries={entries}
            year={formYear}
            years={years}
            today={todayISO()}
            nextReceipt={nextReceipt}
            attachmentCounts={attachmentCounts}
            closedMonths={closedMonths}
            reconciledIds={[...reconciled]}
            range={range}
            scopeLabel={scopeLabel}
            focusIds={focusIds}
          />
        </>
      )}
    </>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: "income" | "expense";
  strong?: boolean;
}) {
  const color =
    tone === "income"
      ? "text-emerald-700"
      : tone === "expense"
        ? "text-rose-700"
        : "text-dark";
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
      <span className="text-muted">{label}</span>
      <span
        className={`tabular-nums ${color} ${strong ? "text-[14px] font-semibold" : ""}`}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}
