import { Banner, Button, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/treasury-format";
import {
  balancesBy,
  getLedgerCatalog,
  getLedgerEntries,
  getLedgerYears,
  periodTotals,
  todayISO,
} from "@/lib/treasury-ledger";
import { LedgerClient } from "./ledger-client";

export const dynamic = "force-dynamic";

export default async function LibroTesoreriaPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const years = await getLedgerYears(supabase);
  const requested = parseInt(searchParams.year ?? "", 10);
  const year = Number.isFinite(requested)
    ? requested
    : (years[0] ?? new Date().getUTCFullYear() - 1843);

  const [catalog, entries, receiptResult] = await Promise.all([
    getLedgerCatalog(supabase),
    getLedgerEntries(supabase, year),
    supabase.rpc("next_receipt_number", { loc: session.locality.id }),
  ]);

  const accountNames = new Map(catalog.accounts.map((a) => [a.id, a.name]));
  const fundNames = new Map(catalog.funds.map((f) => [f.id, f.name]));

  const byAccount = balancesBy(entries, "account_id", accountNames);
  const byFund = balancesBy(entries, "fund_id", fundNames, "Sin fondo");
  const totals = periodTotals(entries);

  const nextReceipt = Number(receiptResult.data) || 1;
  const catalogEmpty = catalog.accounts.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title={`Libro ${year} E.B.`}
        description="Cada línea es un movimiento. El saldo se calcula solo."
        actions={
          <>
            <Button href="/admin/tesoreria/informes">Informes</Button>
            <Button variant="secondary" href="/admin/tesoreria">
              Volver a Tesorería
            </Button>
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
          {/* Saldos: primero por cuenta, que es la plata donde está. */}
          <Card className="mb-4">
            <h2 className="mb-3 font-display text-[18px] font-semibold text-dark">
              Saldo por cuenta
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
                  Sin movimientos en este año.
                </p>
              )}
            </div>
          </Card>

          {/* Saldos por fondo: la misma plata, "coloreada" por destino. */}
          <Card className="mb-4">
            <h2 className="mb-1 font-display text-[18px] font-semibold text-dark">
              Saldo por fondo
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

          {/* Movimiento del período, sin contar el arrastre del año anterior. */}
          {totals.length > 0 && (
            <Card className="mb-5">
              <h2 className="mb-3 font-display text-[18px] font-semibold text-dark">
                Movimiento del año
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {totals.map((t) => (
                  <div
                    key={t.currency}
                    className="rounded-xl border border-black/[0.06] px-3 py-2.5"
                  >
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {t.currency}
                    </div>
                    <Row label="Saldo anterior" value={t.opening} />
                    <Row label="Ingresos" value={t.income} tone="income" />
                    <Row label="Gastos" value={t.expense} tone="expense" />
                    <div className="mt-1 border-t border-black/[0.06] pt-1">
                      <Row
                        label="Saldo actual"
                        value={
                          Math.round((t.opening + t.income + t.expense) * 100) / 100
                        }
                        strong
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <LedgerClient
            catalog={catalog}
            entries={entries}
            year={year}
            years={years}
            today={todayISO()}
            nextReceipt={nextReceipt}
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
