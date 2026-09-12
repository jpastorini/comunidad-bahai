"use client";

import { fmtAmount, fmtLongDate } from "@/lib/treasury-report-content";
import {
  monthLabel,
  summaryTotals,
  type Cashbook,
  type CashbookSheet as Sheet,
} from "@/lib/treasury-cashbook";

/**
 * El Libro Mayor de Caja imprimible: la hoja que se pega en el libro de
 * tapas duras.
 *
 * Formato del instructivo de libros sociales del MEC: cinco columnas
 * (Día, Concepto, Ingresos, Egresos, Saldo), un cierre por mes civil. Como
 * la Asamblea tiene varias cuentas y dos monedas, sale una hoja por cuenta
 * y moneda y, antes, una hoja resumen del mes con todas las cuentas.
 *
 * Dos estados, y la hoja lo dice arriba en grande:
 *   · CERRADO — el mes está cerrado en la app (054). Lo impreso coincide
 *     con lo que la base ya no deja tocar, así que se puede pegar.
 *   · BORRADOR — el mes sigue abierto. Sirve para revisar antes de
 *     cerrar; la marca de agua está para que no termine en el libro.
 *
 * Sin nombres de contribuyentes: el concepto de un aporte es su recibo y
 * su rubro. Es un documento que puede pedir una inspección.
 */

export type CashBookLegal = {
  registeredName: string | null;
  rut: string | null;
  address: string | null;
};

export type CashBookClosing = {
  closedAt: string;
  closedBy: string | null;
};

export function CashBookSheet({
  book,
  localityName,
  legal,
  closing,
  mismatches,
  bahaiYear,
}: {
  book: Cashbook;
  localityName: string;
  legal: CashBookLegal;
  /** Null = el mes está abierto: se imprime como BORRADOR. */
  closing: CashBookClosing | null;
  /** Filas cuyo saldo ya no coincide con el congelado al cerrar. */
  mismatches: Array<{ account: string; currency: string; was: number; now: number }>;
  bahaiYear: number | null;
}) {
  const draft = closing === null;
  const totals = summaryTotals(book.summary);
  const title = legal.registeredName || `Asamblea Espiritual Local de los Bahá'ís de ${localityName}`;

  return (
    <div className="mx-auto w-full max-w-[820px] text-dark">
      <style>{CASHBOOK_CSS}</style>

      <div className="cb-noprint mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="tap rounded-xl bg-terra px-4 py-2 text-[13px] font-semibold text-white shadow-card-soft hover:bg-terra-light"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {mismatches.length > 0 && (
        <div className="cb-noprint mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-800">
          <strong>El libro no coincide con el cierre.</strong> Algún movimiento
          de este mes cambió después de cerrarlo, cosa que la base no debería
          permitir. Revisá antes de imprimir:
          <ul className="mt-1 list-disc pl-5">
            {mismatches.map((m) => (
              <li key={`${m.account}|${m.currency}`}>
                {m.account} ({m.currency}): cerró en {fmtAmount(m.was, m.currency)}, hoy da{" "}
                {fmtAmount(m.now, m.currency)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Hoja resumen del mes ───────────────────────────────── */}
      <article className={`cb-page relative rounded-2xl border border-black/[0.08] bg-white p-6 sm:p-10 ${draft ? "cb-draft" : ""}`}>
        <Header
          title={title}
          legal={legal}
          month={book.month}
          sheet={`Resumen del mes`}
          bahaiYear={bahaiYear}
        />

        <h2 className="mt-5 font-display text-[17px] font-semibold text-dark">
          Saldos por cuenta al cierre de {monthLabel(book.month).toLowerCase()}
        </h2>
        <div className="cb-wide mt-2 -mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-black/20">
                <Th left>Cuenta</Th>
                <Th left>Moneda</Th>
                <Th>Saldo anterior</Th>
                <Th>Ingresos</Th>
                <Th>Egresos</Th>
                <Th>Saldo al cierre</Th>
                <Th>Mov.</Th>
              </tr>
            </thead>
            <tbody>
              {book.summary.map((r) => (
                <tr key={`${r.accountId}|${r.currency}`} className="border-b border-black/[0.08]">
                  <td className="py-1.5 text-dark">{r.account}</td>
                  <td className="py-1.5 text-muted">{r.currency}</td>
                  <Num value={r.opening} currency={r.currency} />
                  <Num value={r.income} currency={r.currency} />
                  <Num value={r.expense} currency={r.currency} />
                  <Num value={r.closing} currency={r.currency} bold />
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.count}</td>
                </tr>
              ))}
              {totals.map((t) => (
                <tr key={`t-${t.currency}`} className="border-t-2 border-black/25">
                  <td className="py-1.5 text-[11.5px] font-bold text-dark" colSpan={2}>
                    Total {t.currency}
                  </td>
                  <Num value={t.opening} currency={t.currency} bold />
                  <Num value={t.income} currency={t.currency} bold />
                  <Num value={t.expense} currency={t.currency} bold />
                  <Num value={t.closing} currency={t.currency} bold />
                  <td className="py-1.5 text-right tabular-nums font-bold text-dark">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Cada moneda se totaliza por separado; los saldos son acumulados desde
          el inicio del libro. Las transferencias entre cuentas figuran en cada
          cuenta como ingreso o egreso y se cancelan entre sí.
          {book.voidedCount > 0 &&
            ` Hay ${book.voidedCount} ${
              book.voidedCount === 1 ? "movimiento anulado" : "movimientos anulados"
            } en el mes, que no se suman.`}
        </p>

        <Footer closing={closing} sheets={book.sheets.length} />
        {draft && <DraftMark />}
      </article>

      {/* ─── Una hoja por cuenta y moneda ────────────────────────── */}
      {book.sheets.map((s, i) => (
        <article
          key={`${s.accountId}|${s.currency}`}
          className={`cb-page relative mt-6 rounded-2xl border border-black/[0.08] bg-white p-6 sm:p-10 ${draft ? "cb-draft" : ""}`}
        >
          <Header
            title={title}
            legal={legal}
            month={book.month}
            sheet={`Hoja ${i + 1} de ${book.sheets.length} · ${s.account} · ${s.currency}`}
            bahaiYear={bahaiYear}
          />
          <AccountTable sheet={s} />
          <Footer closing={closing} sheets={book.sheets.length} />
          {draft && <DraftMark />}
        </article>
      ))}

      {book.sheets.length === 0 && (
        <p className="cb-noprint mt-6 text-center text-[12.5px] text-muted">
          No hay movimientos ni saldos en {monthLabel(book.month).toLowerCase()}.
        </p>
      )}
    </div>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────

function Header({
  title,
  legal,
  month,
  sheet,
  bahaiYear,
}: {
  title: string;
  legal: CashBookLegal;
  month: string;
  sheet: string;
  bahaiYear: number | null;
}) {
  const legalLine = [legal.rut ? `RUT ${legal.rut}` : null, legal.address]
    .filter(Boolean)
    .join(" · ");
  return (
    <header className="border-b-2 border-gold pb-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-dark">
        Libro Mayor de Caja
      </div>
      <h1 className="mt-1 font-display text-[20px] font-semibold leading-tight text-dark">
        {title}
      </h1>
      {legalLine && <p className="mt-0.5 text-[11px] text-muted">{legalLine}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-3">
        <Meta label="Mes" value={monthLabel(month)} />
        <Meta label="Hoja" value={sheet} />
        {bahaiYear && <Meta label="Ejercicio" value={`${bahaiYear} E.B.`} />}
      </dl>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9.5px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-[12px] font-semibold text-dark">{value}</dd>
    </div>
  );
}

function AccountTable({ sheet: s }: { sheet: Sheet }) {
  return (
    <>
      <h2 className="mt-5 font-display text-[17px] font-semibold text-dark">
        {s.account} <span className="text-muted">· {s.currency}</span>
      </h2>
      <div className="cb-wide mt-2 -mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-black/20">
              <Th left>Día</Th>
              <Th left>Concepto</Th>
              <Th>Ingresos</Th>
              <Th>Egresos</Th>
              <Th>Saldo</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/[0.08] bg-black/[0.025]">
              <td className="py-1.5 text-muted">—</td>
              <td className="py-1.5 font-semibold text-dark">Saldo anterior</td>
              <td className="py-1.5" />
              <td className="py-1.5" />
              <Num value={s.opening} currency={s.currency} bold />
            </tr>
            {s.rows.map((r) => (
              <tr key={r.id} className="border-b border-black/[0.06]">
                <td className="py-1.5 tabular-nums text-muted">{r.day}</td>
                <td className="py-1.5 text-dark">
                  {r.concept}
                  {r.internal && (
                    <span className="ml-1.5 rounded bg-black/[0.06] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">
                      interna
                    </span>
                  )}
                  {r.adjustment && (
                    <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                      contra-asiento
                    </span>
                  )}
                </td>
                <Num value={r.income} currency={s.currency} blankZero />
                <Num value={r.expense} currency={s.currency} blankZero />
                <Num value={r.balance} currency={s.currency} />
              </tr>
            ))}
            <tr className="border-t-2 border-black/25">
              <td className="py-1.5" />
              <td className="py-1.5 font-bold text-dark">Totales del mes y saldo al cierre</td>
              <Num value={s.income} currency={s.currency} bold />
              <Num value={s.expense} currency={s.currency} bold />
              <Num value={s.closing} currency={s.currency} bold />
            </tr>
          </tbody>
        </table>
      </div>
      {s.rows.length === 0 && (
        <p className="mt-2 text-[11.5px] text-muted">Sin movimientos en el mes.</p>
      )}
    </>
  );
}

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th
      className={`py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted ${
        left ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function Num({
  value,
  currency,
  bold = false,
  blankZero = false,
}: {
  value: number;
  currency: string;
  bold?: boolean;
  blankZero?: boolean;
}) {
  if (blankZero && Math.abs(value) < 0.005) return <td className="py-1.5" />;
  const negative = value < 0;
  return (
    <td
      className={`py-1.5 text-right tabular-nums ${bold ? "font-bold" : ""} ${
        negative ? "text-rose-700" : "text-dark"
      }`}
    >
      {negative ? `− ${fmtAmount(Math.abs(value), currency)}` : fmtAmount(value, currency)}
    </td>
  );
}

function Footer({ closing, sheets }: { closing: CashBookClosing | null; sheets: number }) {
  return (
    <footer className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-black/15 pt-3 text-[11px] text-muted">
      <div>
        {closing ? (
          <>
            Mes cerrado en la app el {fmtLongDate(closing.closedAt.slice(0, 10))}
            {closing.closedBy ? ` por ${closing.closedBy}` : ""}. Después del cierre
            ningún movimiento del mes se puede alterar; las correcciones son
            contra-asientos en el mes siguiente.
          </>
        ) : (
          <>
            BORRADOR: el mes todavía está abierto. Esta hoja es para revisar y no
            debe pegarse en el libro.
          </>
        )}
        <br />
        Resumen más {sheets} {sheets === 1 ? "hoja" : "hojas"} de cuenta.
      </div>
      <div className="grid grid-cols-2 gap-8 text-center">
        <div className="w-[150px] border-t border-black/40 pt-1">
          Tesorero/a
        </div>
        <div className="w-[150px] border-t border-black/40 pt-1">
          Secretario/a
        </div>
      </div>
    </footer>
  );
}

function DraftMark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="rotate-[-24deg] rounded-lg border-[5px] border-rose-700/25 px-8 py-2 font-display text-[64px] font-bold uppercase tracking-[0.2em] text-rose-700/25">
        Borrador
      </span>
    </div>
  );
}

const CASHBOOK_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm 14mm 16mm; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .cb-noprint { display: none !important; }
  .cb-page { border: 0 !important; border-radius: 0 !important; padding: 0 !important; box-shadow: none !important; margin-top: 0 !important; }
  .cb-page + .cb-page { break-before: page; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .cb-wide { overflow: visible !important; margin: 0 !important; padding: 0 !important; }
}
`;
