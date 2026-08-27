"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BahaiStar } from "@/components/BahaiStar";
import { categoryMeta } from "@/lib/budget";
import {
  fmtAmount,
  fmtDayMonth,
  fmtLongDate,
  primaryCurrency,
  splitByCurrency,
  type NoteKey,
  type ReportBalanceRow,
  type ReportEditorial,
  type ReportMoney,
  type ReportSnapshot,
} from "@/lib/treasury-report-content";

/**
 * El informe de Tesorería como presentación: una sección por pantalla,
 * navegable con flechas, pensada para proyectar en la Fiesta de los
 * Diecinueve Días y para leerse en el celular cuando se comparte el link.
 *
 * No calcula NADA: todo viene del snapshot congelado al guardar el
 * informe (ver lib/treasury-reports.ts). Lo único que decide acá es qué
 * secciones tienen contenido y merecen una pantalla.
 *
 * Regla de monedas: una es la protagonista (la de mayor movimiento, en
 * la práctica el peso) y va en el número grande; las otras van como
 * nota al pie de la misma tarjeta. Nunca se suman entre sí.
 */

export type ReportDeckData = {
  title: string;
  subtitle: string | null;
  periodFrom: string;
  periodTo: string;
  snapshot: ReportSnapshot;
  editorial: ReportEditorial;
};

type Slide = { key: string; node: React.ReactNode };

export function ReportDeck({
  report,
  localityName,
}: {
  report: ReportDeckData;
  localityName: string;
}) {
  const slides = useMemo(() => buildSlides(report, localityName), [report, localityName]);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const total = slides.length;

  const go = useCallback(
    (n: number) => setIndex((prev) => Math.min(Math.max(n, 0), total - 1)),
    [total]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIndex((p) => Math.min(p + 1, total - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((p) => Math.max(p - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  // La pantalla completa se puede salir con Escape sin pasar por el botón,
  // así que el estado se sincroniza con el evento del navegador.
  useEffect(() => {
    function onChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Safari en iPhone no deja pedir pantalla completa: el botón queda
      // sin efecto en vez de romper.
    }
  }

  // Swipe en el celular: el mismo gesto que en cualquier galería.
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Solo horizontal y con recorrido suficiente, para no pisar el scroll
    // vertical de una lista larga de recibos.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(index + (dx < 0 ? 1 : -1));
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-bg text-dark">
      <style>{DECK_CSS}</style>

      {/* Marca de la Asamblea y contador, fijos como en una presentación. */}
      <div className="cb-chrome absolute left-4 top-4 z-20 flex items-center gap-2 sm:left-7 sm:top-6">
        <BahaiStar size={16} color="#C4A235" />
        <span className="hidden text-[11px] font-semibold tracking-[0.06em] text-muted sm:inline">
          A.E.L. de los Bahá'ís de {localityName}
        </span>
      </div>
      <div className="cb-chrome absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-7 sm:top-6">
        <ToolButton
          label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          onClick={toggleFullscreen}
        >
          {fullscreen ? "Salir" : "Pantalla completa"}
        </ToolButton>
        {/* El navegador imprime TODAS las diapositivas, una por hoja, y su
            propio diálogo ofrece "Guardar como PDF". */}
        <ToolButton
          label="Guardar el informe como PDF"
          onClick={() => window.print()}
        >
          PDF
        </ToolButton>
        <span className="ml-1 text-[12px] font-bold tracking-[0.1em] text-gold-dark">
          <span className="text-dark">{index + 1}</span> / {total}
        </span>
      </div>

      {/* Escenario: la diapositiva ocupa la pantalla y scrollea sola si el
          contenido no entra (celular en vertical, listas largas).
          Están TODAS en el DOM y se oculta la que no toca: así el
          navegador puede imprimir el informe completo de una pasada. */}
      <div
        className="cb-stage flex min-h-dvh w-full items-center justify-center px-4 pb-24 pt-16 sm:px-10"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-full">
          {slides.map((s, i) => (
            <div
              key={s.key}
              className={i === index ? "cb-slide w-full" : "cb-off"}
              aria-hidden={i !== index}
            >
              {s.node}
            </div>
          ))}
        </div>
      </div>

      {/* Navegación */}
      <div className="cb-chrome fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-black/[0.06] bg-card/90 px-3 py-2 shadow-card-elevated backdrop-blur">
        <NavButton
          label="Anterior"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          ‹
        </NavButton>
        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Ir a la sección ${i + 1}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-5 bg-gold" : "w-2 bg-gold/35 hover:bg-gold/60"
              }`}
            />
          ))}
        </div>
        <NavButton
          label="Siguiente"
          disabled={index === total - 1}
          onClick={() => go(index + 1)}
        >
          ›
        </NavButton>
      </div>
    </div>
  );
}

/**
 * CSS del deck. Va inline porque es específico de esta pantalla y buena
 * parte solo existe para la impresión, que Tailwind no cubre: hay que
 * desarmar el centrado a pantalla completa, mostrar las diapositivas
 * ocultas, soltar las listas recortadas y pedirle al navegador que
 * imprima los fondos de color (por defecto los descarta).
 */
const DECK_CSS = `
.cb-slide { animation: cbSlideIn .55s cubic-bezier(.2,.7,.2,1) both; }
@keyframes cbSlideIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .cb-slide { animation: none; } }

.cb-off { display: none; }

@media print {
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #fff !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .cb-chrome { display: none !important; }
  .cb-stage { display: block !important; min-height: 0 !important; padding: 0 !important; }
  /* Una diapositiva por hoja, sin cortarla al medio. */
  .cb-off, .cb-slide {
    display: block !important;
    animation: none !important;
    opacity: 1 !important;
    break-inside: avoid;
    break-after: page;
    padding: 6mm 0;
  }
  .cb-off:last-child, .cb-slide:last-child { break-after: auto; }
  /* Las listas largas se imprimen enteras, no recortadas al alto de la
     pantalla; si no entran en la hoja, siguen en la siguiente. */
  .cb-scroll { max-height: none !important; overflow: visible !important; break-inside: auto; }
  /* Los gráficos usan vh, que en la hoja no significa nada útil. */
  .cb-chart { height: 85mm !important; min-height: 0 !important; }
}
`;

function ToolButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="tap rounded-full border border-black/[0.07] bg-card/85 px-3 py-1.5 text-[11px] font-semibold text-gold-dark shadow-card-soft backdrop-blur transition-colors hover:bg-gold hover:text-white"
    >
      {children}
    </button>
  );
}

function NavButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="tap flex h-9 w-9 items-center justify-center rounded-full bg-bg text-[20px] leading-none text-gold-dark transition-colors hover:bg-gold hover:text-white disabled:opacity-30 disabled:hover:bg-bg disabled:hover:text-gold-dark"
    >
      {children}
    </button>
  );
}

// ─── Armado de las diapositivas ──────────────────────────────────

function buildSlides(report: ReportDeckData, localityName: string): Slide[] {
  const { snapshot: s, editorial: ed } = report;
  const slides: Slide[] = [];

  slides.push({
    key: "cover",
    node: <Cover report={report} localityName={localityName} />,
  });

  slides.push({ key: "summary", node: <Summary report={report} /> });

  slides.push({ key: "income", node: <Income report={report} /> });

  if (s.expenseLines.length > 0 || s.expenses.length > 0) {
    slides.push({ key: "expenses", node: <Expenses report={report} /> });
  }

  if (s.byFund.length > 0) {
    slides.push({ key: "funds", node: <Funds report={report} /> });
  }

  if (s.byAccount.length > 0) {
    slides.push({ key: "accounts", node: <Accounts report={report} /> });
  }

  const hasContributions = s.months.some((m) => m.contributions > 0);
  if (ed.showContributionsChart && s.months.length > 1 && hasContributions) {
    slides.push({ key: "chart-aportes", node: <ContributionsChart report={report} /> });
  }

  if (ed.showLocalFundChart && s.months.length > 1 && s.localFund) {
    slides.push({ key: "chart-fondo", node: <LocalFundChart report={report} /> });
  }

  if (ed.showBudget && s.budget && s.budget.lines.length > 0) {
    slides.push({ key: "budget", node: <Budget report={report} /> });
  }

  if (ed.goal) {
    slides.push({ key: "goal", node: <Goal report={report} /> });
  }

  if (ed.destination.length > 0) {
    slides.push({ key: "destination", node: <Destination report={report} /> });
  }

  if (ed.quote || ed.signature) {
    slides.push({ key: "closing", node: <Closing report={report} /> });
  }

  return slides;
}

// ─── Piezas compartidas ──────────────────────────────────────────

function SlideShell({
  eyebrow,
  title,
  sub,
  children,
  note,
  footnote,
  maxWidth = "max-w-5xl",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
  note?: string;
  /** Letra chica: va después de la nota, que es lo importante de leer. */
  footnote?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className={`mx-auto flex w-full flex-col items-center ${maxWidth}`}>
      <div className="mb-5 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-gold-dark">
          <BahaiStar size={12} color="#C4A235" />
          {eyebrow}
        </div>
        <h2 className="mt-2 font-display text-[30px] font-semibold leading-tight text-dark sm:text-[40px]">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[13px] text-muted sm:text-[15px]">{sub}</p>}
      </div>
      {children}
      {note && <Note>{note}</Note>}
      {footnote && (
        <p className="mt-3 text-center text-[12px] leading-snug text-muted">
          {footnote}
        </p>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex w-full items-start gap-2.5 rounded-xl border border-gold/25 border-l-4 border-l-gold bg-gold/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-muted sm:text-[13.5px]">
      <span className="mt-0.5 shrink-0">
        <BahaiStar size={12} color="#C4A235" />
      </span>
      <div className="whitespace-pre-line">{children}</div>
    </div>
  );
}

function Panel({
  title,
  total,
  children,
}: {
  title?: string;
  total?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-card-elevated">
      {(title || total) && (
        <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] bg-bg/60 px-4 py-3 sm:px-6">
          {title && (
            <h3 className="font-display text-[17px] font-semibold text-dark sm:text-[20px]">
              {title}
            </h3>
          )}
          {total && (
            <div className="whitespace-nowrap font-display text-[16px] font-semibold text-gold-dark sm:text-[19px]">
              {total}
            </div>
          )}
        </div>
      )}
      <div className="px-3 py-1.5 sm:px-5">{children}</div>
    </div>
  );
}

function Row({
  label,
  tag,
  right,
  strong,
}: {
  label: React.ReactNode;
  tag?: string;
  right: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-dashed border-black/[0.07] px-1 py-2.5 last:border-b-0 ${
        strong ? "border-t-2 border-solid border-t-black/10 pt-3" : ""
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-semibold text-dark sm:text-[14.5px]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-gold ring-4 ring-gold/15" />
        <span className="truncate">{label}</span>
        {tag && (
          <span className="hidden shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10.5px] font-bold text-gold-dark sm:inline">
            {tag}
          </span>
        )}
      </span>
      <span className="shrink-0 whitespace-nowrap tabular-nums text-[13.5px] font-bold text-dark sm:text-[15px]">
        {right}
      </span>
    </div>
  );
}

type StatTone = "gold" | "green" | "rose" | "teal";

const STAT_TONES: Record<StatTone, { card: string; label: string; value: string }> = {
  gold: {
    card: "from-white to-gold/[0.09] border-gold/25",
    label: "text-gold-dark",
    value: "text-dark",
  },
  green: {
    card: "from-white to-green/[0.12] border-green/25",
    label: "text-green",
    value: "text-green",
  },
  rose: {
    card: "from-white to-rose-500/[0.08] border-rose-300/50",
    label: "text-rose-700",
    value: "text-rose-700",
  },
  teal: {
    card: "from-white to-terra/[0.08] border-terra/20",
    label: "text-terra",
    value: "text-terra",
  },
};

function Stat({
  label,
  value,
  meta,
  tone = "gold",
  currency,
}: {
  label: string;
  value: string;
  meta?: React.ReactNode;
  tone?: StatTone;
  currency?: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${t.card} px-4 py-4 shadow-card-soft sm:px-6 sm:py-5`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold/30 via-gold to-gold/30" />
      <div
        className={`text-[10.5px] font-bold uppercase tracking-[0.16em] ${t.label}`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-display text-[26px] font-semibold leading-none sm:text-[34px] ${t.value}`}
      >
        {value}
        {currency && (
          <span className="ml-1 align-baseline text-[13px] font-bold text-muted">
            {currency}
          </span>
        )}
      </div>
      {meta && <div className="mt-1.5 text-[12px] leading-snug text-muted">{meta}</div>}
    </div>
  );
}

/** Las monedas que no son la protagonista, como línea al pie. */
function OtherCurrencies({ rows }: { rows: ReportMoney[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((r) => (
        <span key={r.currency}>
          {fmtAmount(r.amount, r.currency)} {r.currency}
        </span>
      ))}
    </>
  );
}

function note(ed: ReportEditorial, key: NoteKey): string | undefined {
  return ed.notes[key] || undefined;
}

/** Agrupa filas de saldo por etiqueta, conservando cada moneda aparte. */
function groupBalances(
  rows: ReportBalanceRow[]
): { label: string; amounts: ReportMoney[] }[] {
  const groups = new Map<string, ReportMoney[]>();
  for (const r of rows) {
    const list = groups.get(r.label) ?? [];
    list.push({ currency: r.currency, amount: r.amount });
    groups.set(r.label, list);
  }
  return [...groups.entries()].map(([label, amounts]) => ({
    label,
    // Dentro de un fondo o cuenta, la moneda de mayor saldo va primero.
    amounts: amounts.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  }));
}

/** Suma de una lista de saldos por moneda (nunca entre monedas). */
function totalByCurrency(rows: ReportBalanceRow[]): ReportMoney[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.currency, Math.round(((map.get(r.currency) ?? 0) + r.amount) * 100) / 100);
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

// ─── 1 · Portada ─────────────────────────────────────────────────

function Cover({
  report,
  localityName,
}: {
  report: ReportDeckData;
  localityName: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-gold/25 bg-card shadow-card-elevated">
        <BahaiStar size={48} color="#C4A235" />
      </div>
      <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-gold-dark">
        Informe de Tesorería
      </div>
      <h1 className="mt-3 font-display text-[38px] font-semibold leading-[1.05] text-dark sm:text-[60px]">
        {report.title}
      </h1>
      {report.subtitle && (
        <div className="mt-2 font-display text-[19px] italic text-gold-dark sm:text-[26px]">
          {report.subtitle}
        </div>
      )}
      <div className="relative mx-auto my-7 h-px w-[min(420px,70vw)] bg-gradient-to-r from-transparent via-gold to-transparent">
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold" />
      </div>
      <p className="mx-auto max-w-[34ch] text-[14px] leading-relaxed text-muted sm:text-[16px]">
        Asamblea Espiritual Local de los Bahá'ís de {localityName}
      </p>
      <p className="mt-5 text-[13px] font-bold text-dark sm:text-[15px]">
        Período: <span className="text-gold-dark">{fmtLongDate(report.periodFrom)}</span>{" "}
        al <span className="text-gold-dark">{fmtLongDate(report.periodTo)}</span>
      </p>
    </div>
  );
}

// ─── 2 · Resumen ─────────────────────────────────────────────────

function Summary({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const main = primaryCurrency([...s.income, ...s.expenses, ...s.result]);

  const income = splitByCurrency(s.income, main);
  const expenses = splitByCurrency(s.expenses, main);
  const result = splitByCurrency(s.result, main);
  const closing = totalByCurrency(s.byFund);
  const closingSplit = splitByCurrency(closing, main);

  const receiptRange =
    s.receiptFrom && s.receiptTo
      ? s.receiptFrom === s.receiptTo
        ? `recibo N.º ${s.receiptFrom}`
        : `recibos N.º ${s.receiptFrom} al ${s.receiptTo}`
      : null;

  const resultAmount = result.main?.amount ?? 0;

  return (
    <SlideShell
      eyebrow="Resumen del período"
      title="Vista General"
      sub={`Movimientos del Fondo del ${fmtDayMonth(s.from)} al ${fmtDayMonth(s.to)}`}
      note={note(report.editorial, "summary")}
      maxWidth="max-w-3xl"
    >
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Stat
          tone="green"
          label="Contribuciones recibidas"
          value={fmtAmount(income.main?.amount ?? 0, main)}
          currency={main}
          meta={
            <>
              {s.incomeCount} {s.incomeCount === 1 ? "aporte" : "aportes"}
              {receiptRange && ` · ${receiptRange}`}
              {income.rest.length > 0 && (
                <>
                  {" · "}
                  <OtherCurrencies rows={income.rest} />
                </>
              )}
            </>
          }
        />
        <Stat
          tone="rose"
          label="Egresos del período"
          value={fmtAmount(expenses.main?.amount ?? 0, main)}
          currency={main}
          meta={
            <>
              {s.expenseLines.length === 0
                ? "Sin gastos en el período"
                : `${s.expenseLines.length} ${
                    s.expenseLines.length === 1 ? "movimiento" : "movimientos"
                  }`}
              {expenses.rest.length > 0 && (
                <>
                  {" · "}
                  <OtherCurrencies rows={expenses.rest} />
                </>
              )}
            </>
          }
        />
        <Stat
          tone={resultAmount >= 0 ? "green" : "rose"}
          label="Resultado del período"
          value={`${resultAmount >= 0 ? "+ " : "− "}${fmtAmount(Math.abs(resultAmount), main)}`}
          currency={main}
          meta={
            <>
              {resultAmount >= 0
                ? "Ingresos por encima de los gastos"
                : "Gastos por encima de los ingresos"}
              {result.rest.length > 0 && (
                <>
                  {" · "}
                  <OtherCurrencies rows={result.rest} />
                </>
              )}
            </>
          }
        />
        <Stat
          tone="teal"
          label="Saldo total al cierre"
          value={fmtAmount(closingSplit.main?.amount ?? 0, main)}
          currency={main}
          meta={
            <>
              Al {fmtDayMonth(s.to)}
              {closingSplit.rest.length > 0 && (
                <>
                  {" · "}
                  <OtherCurrencies rows={closingSplit.rest} />
                </>
              )}
            </>
          }
        />
      </div>
    </SlideShell>
  );
}

// ─── 3 · Ingresos ────────────────────────────────────────────────

function Income({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const main = primaryCurrency(s.income);
  const totals = s.income;

  const receiptRange =
    s.receiptFrom && s.receiptTo
      ? s.receiptFrom === s.receiptTo
        ? `1 recibo · N.º ${s.receiptFrom}`
        : `N.º ${s.receiptFrom} al ${s.receiptTo}`
      : "sin recibos numerados";

  return (
    <SlideShell
      eyebrow="Ingresos"
      title="Contribuciones al Fondo"
      sub={`${s.incomeCount} ${s.incomeCount === 1 ? "aporte" : "aportes"} · ${receiptRange}`}
      note={
        note(report.editorial, "income") ??
        "Con profundo agradecimiento a quienes sostienen el Fondo. Las contribuciones son confidenciales: se detallan únicamente por número de recibo."
      }
      maxWidth="max-w-3xl"
    >
      {s.receipts.length === 0 ? (
        <Empty
          title="Sin contribuciones registradas"
          sub="No hay aportes cargados en el libro para este período."
        />
      ) : (
        <Panel
          title="Detalle por recibo"
          total={totals
            .map((t) => `${fmtAmount(t.amount, t.currency)} ${t.currency}`)
            .join("  ·  ")}
        >
          <div className="cb-scroll max-h-[52vh] overflow-y-auto">
            {s.receipts.map((r, i) => (
              <Row
                key={`${r.number ?? "sn"}-${r.date}-${i}`}
                label={
                  r.number ? `Recibo N.º ${r.number}` : "Aporte sin recibo numerado"
                }
                tag={fmtDayMonth(r.date)}
                right={
                  <>
                    {r.count > 1 && (
                      <span className="mr-2 text-[11px] font-semibold text-muted">
                        {r.count} aportes
                      </span>
                    )}
                    <span className={r.currency === "USD" ? "text-green" : ""}>
                      {fmtAmount(r.amount, r.currency)}
                      {r.currency !== main && (
                        <span className="ml-1 text-[11px] text-muted">{r.currency}</span>
                      )}
                    </span>
                  </>
                }
              />
            ))}
          </div>
        </Panel>
      )}
    </SlideShell>
  );
}

// ─── 4 · Egresos ─────────────────────────────────────────────────

function Expenses({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const main = primaryCurrency(s.expenses);

  return (
    <SlideShell
      eyebrow="Egresos"
      title="Gastos del período"
      sub={`Del ${fmtDayMonth(s.from)} al ${fmtLongDate(s.to)}`}
      note={note(report.editorial, "expenses")}
      footnote={
        s.internalTransfers > 0 ? (
          <>
            No se incluyen {s.internalTransfers}{" "}
            {s.internalTransfers === 1
              ? "operación interna"
              : "operaciones internas"}{" "}
            (cambio de caja o compra de divisas): mueven la plata de lugar, no
            la gastan.
          </>
        ) : undefined
      }
      maxWidth="max-w-3xl"
    >
      {s.expenseLines.length === 0 ? (
        <Empty
          title="Sin egresos en el período"
          sub="No se aplicaron gastos del Fondo entre estas dos fechas."
        />
      ) : (
        <Panel
          title="Detalle de egresos"
          total={s.expenses
            .map((t) => `${fmtAmount(t.amount, t.currency)} ${t.currency}`)
            .join("  ·  ")}
        >
          <div className="cb-scroll max-h-[52vh] overflow-y-auto">
            {s.expenseLines.map((l, i) => (
              <Row
                key={`${l.date}-${i}`}
                label={l.label}
                tag={l.fund ?? undefined}
                right={
                  <span className="text-rose-700">
                    − {fmtAmount(l.amount, l.currency)}
                    {l.currency !== main && (
                      <span className="ml-1 text-[11px] text-muted">{l.currency}</span>
                    )}
                  </span>
                }
              />
            ))}
          </div>
        </Panel>
      )}
    </SlideShell>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="w-full rounded-2xl border border-black/[0.06] bg-card px-6 py-12 text-center shadow-card-elevated">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green/10">
        <BahaiStar size={24} color="#6A8B5F" />
      </div>
      <div className="font-display text-[22px] font-semibold text-green sm:text-[26px]">
        {title}
      </div>
      <p className="mt-1.5 text-[13px] text-muted">{sub}</p>
    </div>
  );
}

// ─── 5 · Fondos ──────────────────────────────────────────────────

const FUND_TONES: StatTone[] = ["gold", "green", "teal", "rose"];

function Funds({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const groups = groupBalances(s.byFund);
  const totals = totalByCurrency(s.byFund);

  return (
    <SlideShell
      eyebrow="Saldos al cierre"
      title="Estado de los Fondos"
      sub={`Disponibilidad por destino al ${fmtLongDate(s.to)}`}
      note={
        note(report.editorial, "funds") ??
        "La plata está «coloreada» por fondo: cada fondo tiene su destino y no se mezcla con los otros ni entre monedas."
      }
    >
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g, i) => (
          <Stat
            key={g.label}
            tone={FUND_TONES[i % FUND_TONES.length]}
            label={g.label}
            value={fmtAmount(g.amounts[0].amount, g.amounts[0].currency)}
            currency={g.amounts[0].currency}
            meta={
              g.amounts.length > 1 ? (
                <OtherCurrencies rows={g.amounts.slice(1)} />
              ) : undefined
            }
          />
        ))}
      </div>
      <div className="mt-4 w-full">
        <Panel
          title="Total disponible"
          total={totals
            .map((t) => `${fmtAmount(t.amount, t.currency)} ${t.currency}`)
            .join("  ·  ")}
        >
          <></>
        </Panel>
      </div>
    </SlideShell>
  );
}

// ─── 6 · Cuentas ─────────────────────────────────────────────────

function Accounts({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const groups = groupBalances(s.byAccount);
  const totals = totalByCurrency(s.byAccount);

  return (
    <SlideShell
      eyebrow="Saldos al cierre"
      title="Estado de las Cuentas"
      sub={`Dónde se encuentran los fondos al ${fmtLongDate(s.to)}`}
      note={
        note(report.editorial, "accounts") ??
        `El total de las cuentas concilia con el total de los Fondos: ${totals
          .map((t) => `${fmtAmount(t.amount, t.currency)} ${t.currency}`)
          .join(" y ")}.`
      }
      maxWidth="max-w-3xl"
    >
      <Panel>
        {groups.map((g) => (
          <Row
            key={g.label}
            label={g.label}
            right={
              <span className="flex items-baseline gap-2.5">
                {g.amounts.map((a) => (
                  <span
                    key={a.currency}
                    className={a.currency === "USD" ? "text-green" : ""}
                  >
                    {fmtAmount(a.amount, a.currency)}
                    <span className="ml-1 text-[11px] font-normal text-muted">
                      {a.currency}
                    </span>
                  </span>
                ))}
              </span>
            }
          />
        ))}
      </Panel>
    </SlideShell>
  );
}

// ─── 7 y 8 · Gráficos ────────────────────────────────────────────

/**
 * Barras verticales con divs: escala al ancho disponible sin deformar
 * el texto (un SVG con preserveAspectRatio="none" estira las etiquetas)
 * y no necesita librería de gráficos.
 */
function BarChart({
  data,
  format,
  tone,
}: {
  data: { key: string; label: string; value: number }[];
  format: (v: number) => string;
  tone: "green" | "gold";
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const bar =
    tone === "green"
      ? "bg-green/65 border-green"
      : "bg-gold/60 border-gold-dark";

  return (
    <div className="cb-chart flex h-[38vh] min-h-[220px] w-full items-end gap-2 px-1 pt-6 sm:gap-4">
      {data.map((d) => {
        // Un mínimo visible para que el mes en cero no desaparezca.
        const pct = max > 0 ? Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0) : 0;
        return (
          <div
            key={d.key}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
          >
            <div className="text-[11px] font-bold tabular-nums text-dark sm:text-[12.5px]">
              {d.value > 0 ? format(d.value) : "—"}
            </div>
            <div
              className={`w-full max-w-[92px] rounded-t-lg border-b-0 border ${bar}`}
              style={{ height: `${pct}%` }}
            />
            <div className="w-full truncate border-t border-black/10 pt-1.5 text-center text-[11px] font-bold text-dark sm:text-[13px]">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContributionsChart({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const total = s.months.reduce((sum, m) => sum + m.contributions, 0);
  const first = s.months[0]?.label ?? "";
  const last = s.months[s.months.length - 1]?.label ?? "";

  return (
    <SlideShell
      eyebrow="Progreso del año"
      title="Cantidad de Aportes"
      sub="Aportes recibidos por mes · calendario gregoriano"
      note={note(report.editorial, "contributions")}
    >
      <Panel
        title="Aportes por mes"
        total={`${total} ${total === 1 ? "aporte" : "aportes"} · ${first}–${last}`}
      >
        <BarChart
          tone="green"
          data={s.months.map((m) => ({
            key: m.key,
            label: m.label,
            value: m.contributions,
          }))}
          format={(v) => String(Math.round(v))}
        />
      </Panel>
    </SlideShell>
  );
}

function LocalFundChart({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const fundName = s.localFund?.name ?? "Fondo Local";
  const currency = s.localFund?.currency ?? "UYU";
  const closing = s.months[s.months.length - 1]?.localFundBalance ?? 0;

  return (
    <SlideShell
      eyebrow="Progreso del año"
      title={`Estado del ${fundName}`}
      sub={`Saldo del ${fundName} al cierre de cada mes`}
      note={note(report.editorial, "localFund")}
    >
      <Panel
        title={`Evolución del saldo · ${currency}`}
        total={`${fmtAmount(closing, currency)} ${currency} al cierre`}
      >
        <BarChart
          tone="gold"
          data={s.months.map((m) => ({
            key: m.key,
            label: m.label,
            value: Math.max(m.localFundBalance, 0),
          }))}
          format={(v) => fmtAmount(v, currency)}
        />
      </Panel>
    </SlideShell>
  );
}

// ─── 9 · Presupuesto vs. ejecutado ───────────────────────────────

function Budget({ report }: { report: ReportDeckData }) {
  const s = report.snapshot;
  const budget = s.budget;
  if (!budget) return null;

  const linked = budget.lines.filter((l) => l.linked);
  const unlinked = budget.lines.filter((l) => !l.linked);
  const planned = linked.reduce((sum, l) => sum + l.planned, 0);
  const actual = linked.reduce((sum, l) => sum + l.actual, 0);

  return (
    <SlideShell
      eyebrow="Plan de la Asamblea"
      title="Presupuesto y Ejecución"
      sub={`Presupuesto ${budget.period} · ejecutado del año al ${fmtDayMonth(s.to)}`}
      note={note(report.editorial, "budget")}
      footnote={
        unlinked.length > 0 ? (
          <>
            Sin vincular al libro: {unlinked.map((l) => l.category).join(", ")}.
            Se presupuestaron{" "}
            {fmtAmount(unlinked.reduce((sum, l) => sum + l.planned, 0))} que no
            se pueden comparar todavía.
          </>
        ) : undefined
      }
    >
      <Panel
        title="Por categoría"
        total={`${fmtAmount(actual)} de ${fmtAmount(planned)}`}
      >
        {linked.map((l) => {
          const meta = categoryMeta(l.icon);
          const pct =
            l.planned > 0 ? Math.min((l.actual / l.planned) * 100, 100) : 0;
          const over = l.actual > l.planned;
          return (
            <div
              key={l.category}
              className="border-b border-dashed border-black/[0.07] px-1 py-2.5 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-dark sm:text-[14.5px]">
                  <span aria-hidden="true">{meta.emoji}</span>
                  <span className="truncate">{l.category}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-[13px] font-bold sm:text-[14.5px]">
                  <span className={over ? "text-rose-700" : "text-dark"}>
                    {fmtAmount(l.actual)}
                  </span>
                  <span className="text-muted"> / {fmtAmount(l.planned)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-green"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {linked.length === 0 && (
          <p className="px-1 py-6 text-center text-[13px] text-muted">
            Ninguna línea del presupuesto tiene todavía su categoría del libro
            vinculada, así que no hay ejecutado para comparar.
          </p>
        )}
      </Panel>
    </SlideShell>
  );
}

// ─── 10 · Meta de la Asamblea ────────────────────────────────────

function Goal({ report }: { report: ReportDeckData }) {
  const goal = report.editorial.goal;
  if (!goal) return null;

  const cards = [
    goal.monthly && { label: "Meta mensual", value: goal.monthly, tone: "rose" as StatTone },
    goal.annual && { label: "Meta anual", value: goal.annual, tone: "gold" as StatTone },
    goal.covered && {
      label: "Cubierto por este período",
      value: goal.covered,
      tone: "green" as StatTone,
    },
  ].filter(Boolean) as { label: string; value: string; tone: StatTone }[];

  return (
    <SlideShell
      eyebrow="Meta de la Asamblea"
      title={goal.title}
      sub={goal.subtitle || undefined}
      note={goal.note || undefined}
    >
      {cards.length > 0 && (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <Stat key={c.label} tone={c.tone} label={c.label} value={c.value} />
          ))}
        </div>
      )}
    </SlideShell>
  );
}

// ─── 11 · Destino de los Fondos ──────────────────────────────────

const BADGE_TONES: Record<string, string> = {
  gold: "border-gold/30 bg-gold/10 text-gold-dark",
  green: "border-green/30 bg-green/10 text-green",
  teal: "border-terra/25 bg-terra/[0.08] text-terra",
  rose: "border-rose-300/60 bg-rose-50 text-rose-700",
};

function Destination({ report }: { report: ReportDeckData }) {
  const items = report.editorial.destination;

  return (
    <SlideShell
      eyebrow="Mirando hacia adelante"
      title="Destino de los Fondos"
      sub="Proyectos e iniciativas en curso de la Asamblea"
      note={note(report.editorial, "destination")}
    >
      <Panel>
        {items.map((it, i) => (
          <div
            key={`${it.label}-${i}`}
            className="flex items-center justify-between gap-3 border-b border-dashed border-black/[0.07] px-1 py-3 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-semibold text-dark sm:text-[14.5px]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-gold ring-4 ring-gold/15" />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
              {it.badge && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    BADGE_TONES[it.tone] ?? BADGE_TONES.gold
                  }`}
                >
                  {it.badge}
                </span>
              )}
              {it.amount && (
                <span className="tabular-nums text-[13.5px] font-bold text-dark sm:text-[15px]">
                  {it.amount}
                </span>
              )}
            </span>
          </div>
        ))}
      </Panel>
    </SlideShell>
  );
}

// ─── 12 · Cierre ─────────────────────────────────────────────────

function Closing({ report }: { report: ReportDeckData }) {
  const { quote, signature } = report.editorial;

  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full border border-gold/25 bg-card shadow-card-elevated">
        <BahaiStar size={38} color="#C4A235" />
      </div>
      {quote && (
        <>
          <blockquote className="font-display text-[24px] font-medium italic leading-snug text-dark sm:text-[34px]">
            «{quote.text}»
          </blockquote>
          {quote.source && (
            <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">
              — {quote.source}
            </div>
          )}
        </>
      )}
      {signature && (
        <div className="mt-10 text-[13px] text-muted">
          Con profundo amor y gratitud,
          <div className="mt-1 font-display text-[20px] text-dark">
            {signature.name}
          </div>
          {signature.role && <div className="text-[12px]">{signature.role}</div>}
        </div>
      )}
    </div>
  );
}
