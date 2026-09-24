import { BahaiStar } from "@/components/BahaiStar";
import { FundBalances, ProgressBoard } from "@/components/treasury/ProgressBoard";
import { formatReceiptDate } from "@/lib/treasury-format";
import {
  fmtAmounts,
  publicationLabel,
  type PublicationMonth,
  type TreasuryPublication,
} from "@/lib/treasury-publication-content";

/**
 * El estado del Fondo tal como lo compartió el tesorero (066).
 *
 * Lo mismo que ve la comunidad en /tesoreria y en la Fiesta, y lo que el
 * tesorero revisa antes de tocar "Compartir": un solo componente, así la
 * vista previa no puede diferir de lo publicado. No suma nada — todo viene
 * en la foto.
 *
 * `variant="month"` es la versión corta de la Fiesta: el mes y los saldos,
 * sin el tablero del ejercicio.
 */
export function PublishedTreasury({
  publication,
  variant = "full",
}: {
  publication: TreasuryPublication;
  variant?: "full" | "month";
}) {
  const { month, progress } = publication.snapshot;
  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-[11.5px] font-medium text-muted">
        {publicationLabel(publication)}
      </p>
      {month && <MonthCard month={month} />}
      {progress && progress.balances.length > 0 && (
        <FundBalances
          balances={progress.balances}
          eyebrow={`Al ${formatReceiptDate(publication.as_of)}`}
        />
      )}
      {variant === "full" && progress && <ProgressBoard data={progress} compact />}
    </div>
  );
}

function MonthCard({ month }: { month: PublicationMonth }) {
  return (
    <section className="rounded-[20px] border border-black/[0.05] bg-card p-4 shadow-card-elevated sm:p-6">
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-dark">
          <BahaiStar size={10} color="#C4A235" />
          {month.complete ? "El mes que cerró" : "El mes en curso"}
        </div>
        <h2 className="mt-1 font-display text-[21px] font-semibold leading-tight text-dark sm:text-[25px]">
          Mes de {month.name}
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Del {formatReceiptDate(month.from)} al {formatReceiptDate(month.to)}
          {month.complete ? "" : " (todavía no terminó)"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Ingresos" value={fmtAmounts(month.income)} />
        <Figure label="Egresos" value={fmtAmounts(month.expenses)} />
      </div>
      <p className="mt-2.5 text-[11.5px] text-muted">
        {month.contributions}{" "}
        {month.contributions === 1 ? "aporte recibido" : "aportes recibidos"} en
        el mes. Las transferencias entre cuentas no son movimiento del Fondo y
        no se cuentan.
      </p>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-bg/40 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular-nums text-[16px] font-semibold text-dark">{value}</div>
    </div>
  );
}
