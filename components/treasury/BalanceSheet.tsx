"use client";

import { BahaiStar } from "@/components/BahaiStar";
import {
  fmtAmount,
  fmtLongDate,
  parseRate,
  type ReportBalanceRow,
  type ReportEditorial,
  type ReportMoney,
  type ReportSnapshot,
} from "@/lib/treasury-report-content";
import {
  BalanceTable,
  Empty,
  FillLine,
  InternalTable,
  Meta,
  Note,
  Reconciliation,
  RubroTable,
  SHEET_CSS,
  Section,
  Wide,
  type ReportSheetData,
} from "./ReportSheet";

/**
 * La Memoria y Balance anual: la hoja del ejercicio estatutario.
 *
 * Los estatutos de la AEL (art. XI, Agregados 2 y 3) fijan el cierre del
 * ejercicio económico el 17 de abril y ordenan poner "copias de la
 * memoria y el balance anual" a disposición de todos los bahá'ís de la
 * localidad desde esa fecha. El MEC, por su lado, pide que la memoria y
 * el balance se aprueben y se transcriban al libro de actas. Esta hoja es
 * ese documento: lo que el contador y una inspección esperan encontrar.
 *
 * Se arma con las MISMAS piezas que la hoja del acta (ReportSheet.tsx) y
 * lee el mismo snapshot: rubros, saldos por fondo y por cuenta,
 * transferencias internas. Lo que agrega es lo que un balance tiene y un
 * informe mensual no:
 *
 *  · La MEMORIA en prosa, arriba de las cifras.
 *  · Un ESTADO DE SITUACIÓN con el equivalente en pesos de los saldos en
 *    dólares, a la cotización que el tesorero declara (el libro no guarda
 *    tipo de cambio por movimiento todavía). Sin cotización no totaliza:
 *    la regla "nunca sumar monedas distintas" se rompe solo con un tipo
 *    de cambio dicho y firmado.
 *  · Un ESTADO DE RECURSOS Y GASTOS por rubro, con el resultado.
 *  · Las NOTAS: criterio de conversión, transferencias, observaciones.
 *  · Tres firmas: Coordinador, Secretario y Tesorero, que son los
 *    oficiales que el estatuto nombra (art. VII).
 *
 * Igual que las otras dos, no lleva ningún nombre de contribuyente.
 */

export type BalanceLegal = {
  registeredName: string | null;
  rut: string | null;
  address: string | null;
};

export function BalanceSheet({
  report,
  localityName,
  legal,
  emittedBy,
}: {
  report: ReportSheetData;
  localityName: string;
  legal: BalanceLegal;
  emittedBy?: string | null;
}) {
  const s = report.snapshot;
  const ed = report.editorial;
  const bal = ed.balance;
  const rate = bal ? parseRate(bal.rateUsd) : null;
  const statutory = s.from.endsWith("-04-18") && s.to.endsWith("-04-17");
  const title = legal.registeredName || `Asamblea Espiritual Local de los Bahá'ís de ${localityName}`;
  const legalLine = [legal.rut ? `RUT ${legal.rut}` : null, legal.address]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-[820px] bg-white text-dark">
      <style>{SHEET_CSS}</style>

      <div className="cb-noprint mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft hover:bg-terra-light"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <article className="cb-sheet rounded-2xl border border-black/[0.08] p-6 sm:p-10">
        {/* ─── Encabezado ───────────────────────────────────────── */}
        <header className="cb-block border-b-2 border-gold pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-dark">
                Memoria y Balance anual
              </div>
              <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight text-dark sm:text-[30px]">
                {report.title}
              </h1>
              {report.subtitle && (
                <p className="mt-0.5 text-[13px] text-muted">{report.subtitle}</p>
              )}
              <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-dark">{title}</p>
              {legalLine && <p className="text-[11.5px] text-muted">{legalLine}</p>}
            </div>
            <BahaiStar size={40} color="#C4A235" />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-3">
            <Meta
              label="Ejercicio"
              value={`${fmtLongDate(s.from)} al ${fmtLongDate(s.to)}${
                statutory ? " (estatutario)" : ""
              }`}
            />
            {s.bahaiYear && <Meta label="Año bahá'í" value={`${s.bahaiYear} E.B.`} />}
            {emittedBy && <Meta label="Preparado por" value={emittedBy} />}
          </dl>
        </header>

        {/* ─── 1 · Memoria ──────────────────────────────────────── */}
        <Section title="1 · Memoria del ejercicio">
          {bal?.memo ? (
            <div className="whitespace-pre-line text-[12.5px] leading-relaxed text-dark">
              {bal.memo}
            </div>
          ) : (
            <Empty text="La memoria todavía no fue escrita. Se carga en el editor del informe." />
          )}
        </Section>

        {/* ─── 2 · Estado de situación ──────────────────────────── */}
        <Section title="2 · Estado de situación al cierre">
          <SituationTable rows={s.byAccount} rate={rate} />
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <BalanceTable title="Por fondo" rows={s.byFund} />
            <BalanceTable title="Por cuenta" rows={s.byAccount} />
          </div>
          <Reconciliation byFund={s.byFund} byAccount={s.byAccount} />
          <Note text={ed.notes.accounts ?? ed.notes.funds} />
        </Section>

        {/* ─── 3 · Recursos ─────────────────────────────────────── */}
        <Section title="3 · Recursos del ejercicio, por rubro">
          {s.incomeByRubro.length > 0 ? (
            <RubroTable rubros={s.incomeByRubro} countLabel="Aportes" />
          ) : (
            <Empty text="Sin ingresos en el ejercicio." />
          )}
          <Note text={ed.notes.income} />
        </Section>

        {/* ─── 4 · Gastos ───────────────────────────────────────── */}
        <Section title="4 · Gastos del ejercicio, por rubro">
          {s.expenseByRubro.length > 0 ? (
            <RubroTable rubros={s.expenseByRubro} countLabel="Mov." negative />
          ) : (
            <Empty text="Sin gastos en el ejercicio." />
          )}
          <Note text={ed.notes.expenses} />
        </Section>

        {/* ─── 5 · Resultado ────────────────────────────────────── */}
        <Section title="5 · Resultado del ejercicio">
          <ResultTable income={s.income} expenses={s.expenses} result={s.result} rate={rate} />
          <Note text={ed.notes.summary} />
        </Section>

        {/* ─── 6 · Movimientos internos ─────────────────────────── */}
        {s.internalLines.length > 0 && (
          <Section title="6 · Movimientos internos entre cuentas">
            <InternalTable lines={s.internalLines} />
          </Section>
        )}

        {/* ─── 7 · Notas ────────────────────────────────────────── */}
        <Section title={`${s.internalLines.length > 0 ? 7 : 6} · Notas`}>
          <ol className="list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-dark">
            <li>
              <strong>Base de registro.</strong> El libro registra cada ingreso y cada
              gasto por cuenta, moneda, rubro y fondo; los saldos son acumulados desde
              el inicio del libro. Los ingresos y gastos son los del ejercicio.
            </li>
            <li>
              <strong>Moneda.</strong>{" "}
              {rate ? (
                <>
                  Los saldos en dólares se expresan en pesos a{" "}
                  <span className="tabular-nums">{fmtAmount(rate)}</span> por dólar
                  {bal?.rateDate ? `, cotización del ${fmtLongDate(bal.rateDate)}` : ""}
                  {bal?.rateSource ? ` (${bal.rateSource})` : ""}. Los totales en pesos
                  son el único lugar donde se suman las dos monedas.
                </>
              ) : (
                <>
                  Cada moneda se presenta por separado; no se declaró cotización de
                  cierre, así que no hay un total en pesos.
                </>
              )}
            </li>
            <li>
              <strong>Transferencias internas.</strong>{" "}
              {s.internalTransfers > 0
                ? `Hubo ${s.internalTransfers} ${
                    s.internalTransfers === 1 ? "operación" : "operaciones"
                  } de cambio de caja o compra de divisas, que mueven la plata entre cuentas sin ser ingreso ni gasto y quedan fuera de los estados 3 a 5.`
                : "No hubo cambios de caja ni compras de divisas en el ejercicio."}
            </li>
            <li>
              <strong>Recibos.</strong>{" "}
              {s.receiptFrom && s.receiptTo
                ? `Los aportes del ejercicio están documentados con recibos numerados del ${s.receiptFrom} al ${s.receiptTo}.`
                : "No hay recibos emitidos en el ejercicio."}{" "}
              Los movimientos anulados no integran ninguna cifra.
            </li>
            {ed.observations && (
              <li>
                <strong>Observaciones.</strong>{" "}
                <span className="whitespace-pre-line">{ed.observations}</span>
              </li>
            )}
          </ol>
        </Section>

        {/* ─── Aprobación y firmas ──────────────────────────────── */}
        <section className="cb-approval mt-8 border-t-2 border-gold pt-4">
          <h2 className="mb-3 font-display text-[15px] font-semibold text-dark">
            Aprobado por la Asamblea Espiritual Local
          </h2>
          <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
            <FillLine label="En su reunión del" value={ed.approval?.meetingDate} />
            <FillLine label="Acta N.º" value={ed.approval?.actaNumber} />
          </div>

          <div className="mt-12 grid gap-8 text-[12px] sm:grid-cols-3">
            <Signature name={bal?.signers.coordinator} role="Coordinador/a" />
            <Signature name={bal?.signers.secretary} role="Secretario/a" />
            <Signature name={bal?.signers.treasurer || emittedBy || ""} role="Tesorero/a" />
          </div>
          <p className="mt-6 text-[10.5px] leading-relaxed text-muted">
            Copia de esta memoria y balance queda a disposición de todos los
            bahá'ís de la localidad, conforme al artículo XI del estatuto. No
            contiene nombres de contribuyentes.
          </p>
        </section>
      </article>
    </div>
  );
}

// ─── Piezas propias del balance ──────────────────────────────────

function Signature({ name, role }: { name?: string; role: string }) {
  return (
    <div className="border-t border-black/40 pt-1 text-center">
      {name || " "}
      <div className="text-[11px] text-muted">{role}</div>
    </div>
  );
}

/** Pesos por dólar → equivalente; null si no hay cotización o la moneda
 *  no se convierte. */
function toPesos(amount: number, currency: string, rate: number | null): number | null {
  if (currency === "UYU") return amount;
  if (currency === "USD" && rate) return Math.round(amount * rate * 100) / 100;
  return null;
}

/** Saldos por cuenta con la columna "equivalente en pesos" y el total. */
function SituationTable({
  rows,
  rate,
}: {
  rows: ReportBalanceRow[];
  rate: number | null;
}) {
  if (rows.length === 0) return <Empty text="Sin saldos al cierre." />;
  let total = 0;
  let complete = true;
  const lines = rows.map((r) => {
    const pesos = toPesos(r.amount, r.currency, rate);
    if (pesos === null) complete = false;
    else total = Math.round((total + pesos) * 100) / 100;
    return { ...r, pesos };
  });

  return (
    <Wide>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-black/15">
            <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
              Cuenta
            </th>
            <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
              Saldo
            </th>
            <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
              Equivalente en $
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((r) => (
            <tr key={`${r.label}|${r.currency}`} className="border-b border-black/[0.06]">
              <td className="py-1.5 text-dark">{r.label}</td>
              <td
                className={`py-1.5 text-right tabular-nums ${
                  r.amount < 0 ? "text-rose-700" : "text-dark"
                }`}
              >
                {fmtAmount(r.amount, r.currency)}
                <span className="ml-1 text-[10px] text-muted">{r.currency}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums text-dark">
                {r.pesos === null ? (
                  <span className="text-muted">sin cotización</span>
                ) : (
                  fmtAmount(r.pesos, "UYU")
                )}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-black/15">
            <td className="py-1.5 text-[11.5px] font-bold text-dark" colSpan={2}>
              {complete
                ? "Patrimonio al cierre, en pesos"
                : "Total en pesos de las cuentas convertibles"}
            </td>
            <td className="py-1.5 text-right font-bold tabular-nums text-dark">
              {fmtAmount(total, "UYU")}
            </td>
          </tr>
        </tbody>
      </table>
    </Wide>
  );
}

/** Ingresos, gastos y resultado, moneda por moneda y en pesos. */
function ResultTable({
  income,
  expenses,
  result,
  rate,
}: {
  income: ReportMoney[];
  expenses: ReportMoney[];
  result: ReportMoney[];
  rate: number | null;
}) {
  const currencies = [
    ...new Set([...income, ...expenses, ...result].map((m) => m.currency)),
  ].sort();
  if (currencies.length === 0) return <Empty text="Sin movimientos en el ejercicio." />;

  const get = (rows: ReportMoney[], c: string) =>
    rows.find((m) => m.currency === c)?.amount ?? 0;
  const pesos = (rows: ReportMoney[]) => {
    let t = 0;
    for (const c of currencies) {
      const p = toPesos(get(rows, c), c, rate);
      if (p === null) return null;
      t = Math.round((t + p) * 100) / 100;
    }
    return t;
  };
  const totals = { income: pesos(income), expenses: pesos(expenses), result: pesos(result) };

  return (
    <Wide>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-black/15">
            <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted" />
            {currencies.map((c) => (
              <th
                key={c}
                className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted"
              >
                {c}
              </th>
            ))}
            {rate && (
              <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
                Total en $
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          <Line label="Recursos" rows={income} currencies={currencies} total={rate ? totals.income : null} />
          <Line
            label="Gastos"
            rows={expenses}
            currencies={currencies}
            total={rate ? totals.expenses : null}
            negative
          />
          <Line
            label="Resultado del ejercicio"
            rows={result}
            currencies={currencies}
            total={rate ? totals.result : null}
            strong
          />
        </tbody>
      </table>
    </Wide>
  );
}

function Line({
  label,
  rows,
  currencies,
  total,
  negative = false,
  strong = false,
}: {
  label: string;
  rows: ReportMoney[];
  currencies: string[];
  total: number | null;
  negative?: boolean;
  strong?: boolean;
}) {
  const cell = (value: number, currency?: string) => {
    const neg = negative || value < 0;
    const sign = neg ? "− " : strong ? "+ " : "";
    return (
      <span className={neg ? "text-rose-700" : strong ? "text-green" : "text-dark"}>
        {sign}
        {fmtAmount(Math.abs(value), currency)}
      </span>
    );
  };
  return (
    <tr className={`border-b border-black/[0.06] ${strong ? "border-t-2 border-t-black/15" : ""}`}>
      <td className={`py-1.5 text-left ${strong ? "font-bold" : ""} text-dark`}>{label}</td>
      {currencies.map((c) => {
        const found = rows.find((m) => m.currency === c);
        return (
          <td key={c} className={`py-1.5 text-right tabular-nums ${strong ? "font-bold" : ""}`}>
            {found ? cell(found.amount, c) : <span className="text-muted">—</span>}
          </td>
        );
      })}
      {total !== null && (
        <td className={`py-1.5 text-right tabular-nums ${strong ? "font-bold" : ""}`}>
          {cell(total, "UYU")}
        </td>
      )}
    </tr>
  );
}
