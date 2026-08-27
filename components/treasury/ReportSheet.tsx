"use client";

import { Fragment } from "react";
import { BahaiStar } from "@/components/BahaiStar";
import { categoryMeta } from "@/lib/budget";
import {
  fmtAmount,
  fmtLongDate,
  primaryCurrency,
  type NoteKey,
  type ReportBalanceRow,
  type ReportBudgetLine,
  type ReportEditorial,
  type ReportInternalLine,
  type ReportMoney,
  type ReportRubro,
  type ReportSnapshot,
} from "@/lib/treasury-report-content";

/**
 * El informe interno: una HOJA, no una presentación.
 *
 * Va adjunto al acta de la Asamblea y se aprueba en reunión, así que
 * está pensado para el papel: A4 vertical, tablas, sin gráficos y sin
 * nada que dependa de animarse o de navegarse. Lo que se ve en pantalla
 * es exactamente lo que sale impreso.
 *
 * Tres diferencias de fondo con el deck de la comunidad
 * (components/treasury/ReportDeck.tsx):
 *
 *  · **Totales por rubro, no movimiento por movimiento.** La Asamblea
 *    aprueba a nivel de rubro; el detalle asiento por asiento está en el
 *    libro, que es del tesorero.
 *  · **Muestra lo administrativo que a la comunidad no le dice nada:**
 *    la conciliación fondos ↔ cuentas, las transferencias internas y los
 *    pendientes de la Tesorería.
 *  · **Termina en un bloque de aprobación** con las líneas del acta.
 *
 * Igual que el deck, no lleva NINGÚN nombre de contribuyente.
 */

export type ReportSheetData = {
  title: string;
  subtitle: string | null;
  periodFrom: string;
  periodTo: string;
  snapshot: ReportSnapshot;
  editorial: ReportEditorial;
};

export function ReportSheet({
  report,
  localityName,
  emittedBy,
}: {
  report: ReportSheetData;
  localityName: string;
  /** Quién emite la hoja: el tesorero. Sale del perfil, no del editorial. */
  emittedBy?: string | null;
}) {
  const s = report.snapshot;
  const ed = report.editorial;
  const main = primaryCurrency([...s.income, ...s.expenses]);

  return (
    <div className="mx-auto w-full max-w-[820px] bg-white text-dark">
      <style>{SHEET_CSS}</style>

      {/* Barra de acciones: no se imprime. */}
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
                Informe de Tesorería · Uso interno
              </div>
              <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight text-dark sm:text-[30px]">
                {report.title}
              </h1>
              {report.subtitle && (
                <p className="mt-0.5 text-[13px] text-muted">{report.subtitle}</p>
              )}
              <p className="mt-2 text-[12.5px] leading-relaxed text-dark">
                Asamblea Espiritual Local de los Bahá'ís de {localityName}
              </p>
            </div>
            <BahaiStar size={40} color="#C4A235" />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-3">
            <Meta label="Período" value={`${fmtLongDate(s.from)} al ${fmtLongDate(s.to)}`} />
            {s.bahaiYear && (
              <Meta label="Ejercicio" value={`${s.bahaiYear} E.B. (Riḍván a Riḍván)`} />
            )}
            {emittedBy && <Meta label="Emitido por" value={emittedBy} />}
          </dl>
        </header>

        {/* ─── 1 · Resumen ──────────────────────────────────────── */}
        <Section title="1 · Resumen del período">
          <Table
            head={["Concepto", ...currencyColumns(s, main)]}
            align="right"
            rows={[
              row("Contribuciones recibidas", s.income, s, main),
              row("Egresos aplicados", s.expenses, s, main, true),
              row("Resultado del período", s.result, s, main, false, true),
            ]}
          />
          <p className="mt-1.5 text-[11.5px] text-muted">
            {s.incomeCount} {s.incomeCount === 1 ? "aporte" : "aportes"}
            {s.receiptFrom && s.receiptTo
              ? s.receiptFrom === s.receiptTo
                ? ` · recibo N.º ${s.receiptFrom}`
                : ` · recibos N.º ${s.receiptFrom} al ${s.receiptTo}`
              : " · sin recibos numerados"}
            {" · "}
            {s.expenseLines.length}{" "}
            {s.expenseLines.length === 1 ? "movimiento de egreso" : "movimientos de egreso"}.
            Las transferencias entre cuentas no cuentan como ingreso ni como
            gasto; van en la sección 5.
          </p>
          <Note text={note(ed, "summary")} />
        </Section>

        {/* ─── 2 · Ingresos por rubro ───────────────────────────── */}
        <Section title="2 · Ingresos por rubro">
          {s.incomeByRubro.length === 0 ? (
            <Empty text="Sin contribuciones registradas en el período." />
          ) : (
            <RubroTable rubros={s.incomeByRubro} countLabel="Aportes" />
          )}
          <p className="mt-1.5 text-[11.5px] text-muted">
            El detalle por contribuyente no forma parte de este informe: las
            contribuciones son confidenciales y quedan en el libro, a cargo de
            la Tesorería.
          </p>
          <Note text={note(ed, "income")} />
        </Section>

        {/* ─── 3 · Egresos por rubro ────────────────────────────── */}
        <Section title="3 · Egresos por rubro">
          {s.expenseByRubro.length === 0 ? (
            <Empty text="No se aplicaron gastos del Fondo en el período." />
          ) : (
            <RubroTable rubros={s.expenseByRubro} countLabel="Movim." negative />
          )}
          <Note text={note(ed, "expenses")} />
        </Section>

        {/* ─── 4 · Saldos y conciliación ────────────────────────── */}
        <Section title="4 · Saldos al cierre y conciliación">
          <div className="grid gap-4 sm:grid-cols-2">
            <BalanceTable title="Por fondo" rows={s.byFund} />
            <BalanceTable title="Por cuenta" rows={s.byAccount} />
          </div>
          <Reconciliation byFund={s.byFund} byAccount={s.byAccount} />
          <p className="mt-1.5 text-[11.5px] text-muted">
            Los saldos son acumulados a la fecha de cierre —incluyen el arrastre
            del ejercicio anterior—, no del período informado.
          </p>
          <Note text={note(ed, "funds")} />
          <Note text={note(ed, "accounts")} />
        </Section>

        {/* ─── 5 · Movimientos internos ─────────────────────────── */}
        <Section title="5 · Movimientos internos">
          {s.internalLines.length === 0 ? (
            <Empty text="Sin cambios de caja ni compras de divisas en el período." />
          ) : (
            <InternalTable lines={s.internalLines} />
          )}
        </Section>

        {/* ─── 6 · Presupuesto ──────────────────────────────────── */}
        {s.budget && s.budget.lines.length > 0 && (
          <Section title={`6 · Presupuesto ${s.budget.period} y ejecución`}>
            <BudgetTable lines={s.budget.lines} />
            <p className="mt-1.5 text-[11.5px] text-muted">
              El ejecutado es del ejercicio a la fecha de cierre, no del período
              informado: el presupuesto es anual.
            </p>
            <Note text={note(ed, "budget")} />
          </Section>
        )}

        {/* ─── 7 · Observaciones ────────────────────────────────── */}
        {ed.observations && (
          <Section title="7 · Observaciones y pendientes">
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-dark">
              {ed.observations}
            </p>
          </Section>
        )}

        {/* ─── Aprobación ───────────────────────────────────────── */}
        <Approval editorial={ed} emittedBy={emittedBy} />
      </article>
    </div>
  );
}

/**
 * CSS de la hoja. Casi todo es para la impresión: A4 vertical, sin
 * sombras ni bordes redondeados, y sobre todo sin partir una tabla al
 * medio entre dos hojas, que es lo que arruina un anexo de acta.
 */
const SHEET_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm 14mm 16mm; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .cb-noprint { display: none !important; }
  .cb-sheet { border: 0 !important; border-radius: 0 !important; padding: 0 !important; box-shadow: none !important; }
  /* Ni una sección ni una tabla se cortan entre hojas. */
  .cb-block { break-inside: avoid; }
  .cb-block table { break-inside: avoid; }
  .cb-approval { break-inside: avoid; break-before: auto; }
  /* Los encabezados de tabla se repiten si una tabla larga igual se parte. */
  thead { display: table-header-group; }
  /* Sin scroll en el papel. */
  .cb-wide { overflow: visible !important; margin: 0 !important; padding: 0 !important; }
}
`;

// ─── Piezas ──────────────────────────────────────────────────────

/** "− $ 7.561" y no "$ -7.561": el signo va antes del símbolo. */
function fmtSigned(amount: number, currency?: string): string {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < 0) return `− ${fmtAmount(Math.abs(rounded), currency)}`;
  return fmtAmount(rounded, currency);
}

/**
 * Envoltorio de tabla. En una pantalla angosta una tabla de cuatro
 * columnas no puede bajar de su ancho mínimo y empujaría el ancho de
 * todo el documento, así que scrollea sola. Al imprimir el envoltorio se
 * desarma: en la hoja no hay scroll.
 */
function Wide({ children }: { children: React.ReactNode }) {
  return <div className="cb-wide -mx-1 overflow-x-auto px-1">{children}</div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9.5px] font-bold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="text-[12px] font-semibold text-dark">{value}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cb-block mt-6">
      <h2 className="mb-2 border-b border-black/10 pb-1 font-display text-[16px] font-semibold text-dark">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Note({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mt-2 border-l-2 border-gold/50 pl-3 text-[12px] leading-relaxed text-muted">
      {text}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-black/15 px-3 py-3 text-center text-[12px] text-muted">
      {text}
    </p>
  );
}

function note(ed: ReportEditorial, key: NoteKey): string | undefined {
  return ed.notes[key] || undefined;
}

// ─── Tablas ──────────────────────────────────────────────────────

type Cell = { text: string; bold?: boolean; tone?: "neutral" | "negative" | "positive" };

function Table({
  head,
  rows,
  align = "right",
}: {
  head: string[];
  rows: Cell[][];
  align?: "left" | "right";
}) {
  return (
    <Wide>
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-black/15">
          {head.map((h, i) => (
            <th
              key={h + i}
              className={`py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted ${
                i === 0 ? "text-left" : align === "right" ? "text-right" : "text-left"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, ri) => (
          <tr key={ri} className="border-b border-black/[0.06] last:border-b-0">
            {cells.map((c, ci) => (
              <td
                key={ci}
                className={`py-1.5 ${
                  ci === 0
                    ? "text-left"
                    : align === "right"
                      ? "text-right tabular-nums"
                      : "text-left tabular-nums"
                } ${
                  c.bold ? "font-bold" : ""
                } ${
                  c.tone === "negative"
                    ? "text-rose-700"
                    : c.tone === "positive"
                      ? "text-green"
                      : "text-dark"
                }`}
              >
                {c.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </Wide>
  );
}

/** Las monedas que aparecen en el informe, en orden: la principal primero. */
function currencyColumns(s: ReportSnapshot, main: string): string[] {
  const all = new Set<string>();
  for (const m of [...s.income, ...s.expenses, ...s.result]) all.add(m.currency);
  const rest = [...all].filter((c) => c !== main).sort();
  return all.has(main) ? [main, ...rest] : rest.length > 0 ? rest : [main];
}

function row(
  label: string,
  amounts: ReportMoney[],
  s: ReportSnapshot,
  main: string,
  negative = false,
  strong = false
): Cell[] {
  const cols = currencyColumns(s, main);
  return [
    { text: label, bold: strong },
    ...cols.map((currency) => {
      const found = amounts.find((a) => a.currency === currency);
      if (!found) return { text: "—", tone: "neutral" as const };
      const value = found.amount;
      const sign = negative ? "− " : strong && value >= 0 ? "+ " : value < 0 ? "− " : "";
      return {
        text: `${sign}${fmtAmount(Math.abs(value), currency)}`,
        bold: strong,
        tone: negative || value < 0 ? ("negative" as const) : strong ? ("positive" as const) : ("neutral" as const),
      };
    }),
  ];
}

/** Rubros agrupados por categoría, con subtotal por categoría. */
function RubroTable({
  rubros,
  countLabel,
  negative = false,
}: {
  rubros: ReportRubro[];
  countLabel: string;
  negative?: boolean;
}) {
  const byCategory = new Map<string, ReportRubro[]>();
  for (const r of rubros) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  return (
    <Wide>
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-black/15">
          <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
            Rubro
          </th>
          <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
            {countLabel}
          </th>
          <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
            Monto
          </th>
        </tr>
      </thead>
      <tbody>
        {[...byCategory.entries()].map(([category, list]) => {
          // El subtotal se muestra solo si la categoría tiene más de un
          // rubro: repetir la misma cifra dos veces no informa nada.
          const showSubtotal = list.length > 1;
          const totals = new Map<string, number>();
          for (const r of list) {
            totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
          }
          return (
            <Fragment key={category}>
              <tr className="bg-bg/60">
                <td
                  colSpan={3}
                  className="py-1 text-[10.5px] font-bold uppercase tracking-wide text-gold-dark"
                >
                  {category || "Sin categoría"}
                </td>
              </tr>
              {list.map((r, i) => (
                <tr
                  key={`${category}-${r.subcategory}-${r.currency}-${i}`}
                  className="border-b border-black/[0.06]"
                >
                  <td className="py-1.5 pl-3 text-dark">{r.subcategory || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">
                    {r.count}
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${
                      negative ? "text-rose-700" : "text-dark"
                    }`}
                  >
                    {negative ? "− " : ""}
                    {fmtAmount(r.amount, r.currency)}
                    {r.currency !== "UYU" && (
                      <span className="ml-1 text-[10px] text-muted">{r.currency}</span>
                    )}
                  </td>
                </tr>
              ))}
              {showSubtotal && (
                <tr className="border-b border-black/15">
                  <td className="py-1.5 pl-3 text-[11.5px] font-semibold text-muted">
                    Subtotal {category}
                  </td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums text-[12px] font-bold text-dark">
                    {[...totals.entries()]
                      .map(([c, a]) => `${negative ? "− " : ""}${fmtAmount(a, c)}${c !== "UYU" ? ` ${c}` : ""}`)
                      .join("  ·  ")}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
    </Wide>
  );
}

function BalanceTable({
  title,
  rows,
}: {
  title: string;
  rows: ReportBalanceRow[];
}) {
  const totals = totalByCurrency(rows);
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <Wide>
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.label}|${r.currency}`}
              className="border-b border-black/[0.06]"
            >
              <td className="py-1 text-dark">{r.label}</td>
              <td
                className={`py-1 text-right tabular-nums ${
                  r.amount < 0 ? "text-rose-700" : "text-dark"
                }`}
              >
                {fmtAmount(r.amount, r.currency)}
                <span className="ml-1 text-[10px] text-muted">{r.currency}</span>
              </td>
            </tr>
          ))}
          {totals.map((t) => (
            <tr key={`t-${t.currency}`} className="border-t-2 border-black/15">
              <td className="py-1 text-[11.5px] font-bold text-dark">
                Total {t.currency}
              </td>
              <td className="py-1 text-right font-bold tabular-nums text-dark">
                {fmtAmount(t.amount, t.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </Wide>
    </div>
  );
}

function totalByCurrency(rows: ReportBalanceRow[]): ReportMoney[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.currency, Math.round(((map.get(r.currency) ?? 0) + r.amount) * 100) / 100);
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

/**
 * El control que un revisor busca primero: la plata agrupada por fondo y
 * la misma plata agrupada por cuenta tienen que dar igual, moneda por
 * moneda. Si no da, se dice en rojo en vez de disimularlo.
 */
function Reconciliation({
  byFund,
  byAccount,
}: {
  byFund: ReportBalanceRow[];
  byAccount: ReportBalanceRow[];
}) {
  const funds = totalByCurrency(byFund);
  const accounts = totalByCurrency(byAccount);
  const currencies = [
    ...new Set([...funds, ...accounts].map((r) => r.currency)),
  ].sort();

  if (currencies.length === 0) return null;

  const checks = currencies.map((currency) => {
    const f = funds.find((r) => r.currency === currency)?.amount ?? 0;
    const a = accounts.find((r) => r.currency === currency)?.amount ?? 0;
    const diff = Math.round((f - a) * 100) / 100;
    return { currency, fund: f, account: a, diff };
  });
  const ok = checks.every((c) => Math.abs(c.diff) < 0.005);

  return (
    <div
      className={`mt-3 rounded border px-3 py-2 text-[12px] ${
        ok ? "border-green/30 bg-green/[0.06]" : "border-rose-300 bg-rose-50"
      }`}
    >
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        Conciliación
      </div>
      {checks.map((c) => (
        <div key={c.currency} className="flex justify-between gap-3">
          <span className="text-dark">
            {c.currency}: fondos {fmtAmount(c.fund, c.currency)} · cuentas{" "}
            {fmtAmount(c.account, c.currency)}
          </span>
          <span
            className={`shrink-0 font-bold tabular-nums ${
              Math.abs(c.diff) < 0.005 ? "text-green" : "text-rose-700"
            }`}
          >
            {Math.abs(c.diff) < 0.005
              ? "coincide"
              : `diferencia ${fmtAmount(c.diff, c.currency)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Las transferencias con sus dos patas, agrupadas por operación. */
function InternalTable({ lines }: { lines: ReportInternalLine[] }) {
  const groups = new Map<string, ReportInternalLine[]>();
  for (const l of lines) {
    const list = groups.get(l.group) ?? [];
    list.push(l);
    groups.set(l.group, list);
  }

  return (
    <>
      <Wide>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-black/15">
            <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
              Fecha
            </th>
            <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
              Operación
            </th>
            <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
              Sale de
            </th>
            <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
              Entra a
            </th>
          </tr>
        </thead>
        <tbody>
          {[...groups.values()].map((legs, i) => {
            const out = legs.find((l) => l.amount < 0);
            const into = legs.find((l) => l.amount > 0);
            // Si las dos patas están en monedas distintas, el tipo de
            // cambio queda implícito en los dos montos: lo explicitamos.
            const rate =
              out && into && out.currency !== into.currency && into.amount !== 0
                ? Math.abs(out.amount) / into.amount
                : null;
            return (
              <tr key={i} className="border-b border-black/[0.06]">
                <td className="py-1.5 text-muted">{fmtLongDate(legs[0].date)}</td>
                <td className="py-1.5 text-dark">
                  {legs[0].label}
                  {rate && (
                    <span className="ml-1 text-[10.5px] text-muted">
                      {" "}(tipo de cambio {rate.toFixed(2)})
                    </span>
                  )}
                </td>
                <td className="py-1.5 tabular-nums text-rose-700">
                  {out
                    ? `${out.account} · ${fmtAmount(Math.abs(out.amount), out.currency)} ${out.currency}`
                    : "—"}
                </td>
                <td className="py-1.5 tabular-nums text-green">
                  {into
                    ? `${into.account} · ${fmtAmount(into.amount, into.currency)} ${into.currency}`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </Wide>
      <p className="mt-1.5 text-[11.5px] text-muted">
        Estas operaciones mueven la plata de lugar sin que entre ni salga nada
        del Fondo, así que no figuran en los ingresos ni en los egresos. El
        costo del giro, cuando lo hay, sí se informa como gasto.
      </p>
    </>
  );
}

function BudgetTable({ lines }: { lines: ReportBudgetLine[] }) {
  const rows = lines;
  // El total compara solo lo comparable: sumar en "presupuestado" una
  // línea sin ejecutado conocido y restarla del saldo daría un número que
  // parece un sobrante y no lo es.
  const linked = rows.filter((l) => l.linked);
  const planned = linked.reduce((s, l) => s + l.planned, 0);
  const actual = linked.reduce((s, l) => s + l.actual, 0);
  const unlinkedPlanned = rows
    .filter((l) => !l.linked)
    .reduce((s, l) => s + l.planned, 0);

  return (
    <>
      {renderBudgetTable(rows, planned, actual)}
      {unlinkedPlanned > 0 && (
        <p className="mt-1.5 text-[11.5px] text-muted">
          El total incluye únicamente las categorías vinculadas al libro.
          Quedan {fmtAmount(unlinkedPlanned)} presupuestados que todavía no se
          pueden comparar.
        </p>
      )}
    </>
  );
}

function renderBudgetTable(
  rows: ReportBudgetLine[],
  planned: number,
  actual: number
) {
  return (
    <Wide>
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-b border-black/15">
          <th className="py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
            Categoría
          </th>
          <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
            Presupuestado
          </th>
          <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
            Ejecutado
          </th>
          <th className="py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-muted">
            Saldo
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => {
          const meta = categoryMeta(l.icon);
          const rest = l.planned - l.actual;
          return (
            <tr key={l.category} className="border-b border-black/[0.06]">
              <td className="py-1.5 text-dark">
                <span aria-hidden="true" className="mr-1">
                  {meta.emoji}
                </span>
                {l.category}
                {!l.linked && (
                  <span className="ml-1 text-[10.5px] italic text-muted">
                    (sin vincular al libro)
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums text-dark">
                {fmtAmount(l.planned)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-dark">
                {l.linked ? fmtAmount(l.actual) : "—"}
              </td>
              <td
                className={`py-1.5 text-right tabular-nums ${
                  l.linked && rest < 0 ? "font-bold text-rose-700" : "text-muted"
                }`}
              >
                {l.linked ? fmtSigned(rest) : "—"}
              </td>
            </tr>
          );
        })}
        <tr className="border-t-2 border-black/15">
          <td className="py-1.5 font-bold text-dark">Total comparable</td>
          <td className="py-1.5 text-right font-bold tabular-nums text-dark">
            {fmtAmount(planned)}
          </td>
          <td className="py-1.5 text-right font-bold tabular-nums text-dark">
            {fmtAmount(actual)}
          </td>
          <td className="py-1.5 text-right font-bold tabular-nums text-dark">
            {fmtSigned(planned - actual)}
          </td>
        </tr>
      </tbody>
    </table>
    </Wide>
  );
}

// ─── Aprobación ──────────────────────────────────────────────────

function Approval({
  editorial,
  emittedBy,
}: {
  editorial: ReportEditorial;
  emittedBy?: string | null;
}) {
  const appr = editorial.approval;
  const signature = editorial.signature;

  return (
    <section className="cb-approval mt-8 border-t-2 border-gold pt-4">
      <h2 className="mb-3 font-display text-[15px] font-semibold text-dark">
        Visto y aprobado por la Asamblea Espiritual Local
      </h2>
      <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
        <FillLine label="En su reunión del" value={appr?.meetingDate} />
        <FillLine label="Acta N.º" value={appr?.actaNumber} />
      </div>

      <div className="mt-10 grid gap-10 text-[12px] sm:grid-cols-2">
        <div className="border-t border-black/40 pt-1 text-center">
          {signature?.name || emittedBy || " "}
          <div className="text-[11px] text-muted">
            {signature?.role || "Tesorero/a"}
          </div>
        </div>
        <div className="border-t border-black/40 pt-1 text-center">
          &nbsp;
          <div className="text-[11px] text-muted">Secretario/a de la Asamblea</div>
        </div>
      </div>
    </section>
  );
}

/** Dato cargado, o una línea de puntos para completar a mano. */
function FillLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-muted">{label}</span>
      {value ? (
        <span className="font-semibold text-dark">{value}</span>
      ) : (
        <span className="flex-1 border-b border-dotted border-black/40">
          &nbsp;
        </span>
      )}
    </div>
  );
}
