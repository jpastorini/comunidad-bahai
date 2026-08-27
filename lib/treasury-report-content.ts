/**
 * Informe de Tesorería — tipos y saneado del contenido.
 *
 * Vive aparte de lib/treasury-reports.ts (que es server-only porque hace
 * queries) para que el deck del informe, que es un componente de cliente,
 * pueda importar los tipos y los helpers puros sin arrastrar el módulo
 * de datos al bundle. Mismo motivo que lib/treasury-format.ts.
 *
 * Dos mitades bien separadas:
 *   · ReportSnapshot  — las cifras, calculadas desde el libro.
 *   · ReportEditorial — los textos que escribe el tesorero.
 */

export type ReportMoney = { currency: string; amount: number };

/** Una línea del detalle de ingresos. Sin nombre de contribuyente: el
 *  informe es para la comunidad y los aportes son confidenciales. */
export type ReportReceipt = {
  number: number | null;
  date: string;
  amount: number;
  currency: string;
  /** Cuántos aportes agrupa (la canasta de la Fiesta es una sola línea). */
  count: number;
  fund: string | null;
};

export type ReportExpenseLine = {
  label: string;
  category: string | null;
  fund: string | null;
  amount: number;
  currency: string;
  date: string;
};

export type ReportBalanceRow = {
  label: string;
  currency: string;
  amount: number;
};

/** Un mes gregoriano del año bahá'í en curso, para los dos gráficos. */
export type ReportMonth = {
  key: string;
  label: string;
  /** Cantidad de aportes recibidos en el mes. */
  contributions: number;
  /** Saldo del Fondo Local en pesos al cierre del mes. */
  localFundBalance: number;
};

export type ReportBudgetLine = {
  category: string;
  icon: string;
  planned: number;
  /** Ejecutado en el año bahá'í, según la categoría del libro vinculada. */
  actual: number;
  /** false = la línea todavía no tiene categoría del libro asignada. */
  linked: boolean;
};

export type ReportSnapshot = {
  from: string;
  to: string;
  bahaiYear: number | null;
  /** Contribuciones del período, por moneda. */
  income: ReportMoney[];
  /** Cantidad de aportes (suma de contributions_count). */
  incomeCount: number;
  receiptFrom: number | null;
  receiptTo: number | null;
  receipts: ReportReceipt[];
  /** Egresos del período, por moneda, en valor absoluto. */
  expenses: ReportMoney[];
  expenseLines: ReportExpenseLine[];
  /** Ingresos menos egresos del período. Puede ser negativo. */
  result: ReportMoney[];
  /** Saldos ACUMULADOS al cierre (todo el libro hasta `to`). */
  byFund: ReportBalanceRow[];
  byAccount: ReportBalanceRow[];
  months: ReportMonth[];
  /** Qué fondo y en qué moneda grafica `months[].localFundBalance`. El
   *  fondo no está marcado en la base: se elige por nombre. */
  localFund: { name: string; currency: string } | null;
  budget: { period: string; lines: ReportBudgetLine[] } | null;
  /** Operaciones internas del período (cambio de caja, compra de divisas)
   *  que quedaron fuera de ingresos y egresos. */
  internalTransfers: number;
};

export const EMPTY_SNAPSHOT: ReportSnapshot = {
  from: "",
  to: "",
  bahaiYear: null,
  income: [],
  incomeCount: 0,
  receiptFrom: null,
  receiptTo: null,
  receipts: [],
  expenses: [],
  expenseLines: [],
  result: [],
  byFund: [],
  byAccount: [],
  months: [],
  localFund: null,
  budget: null,
  internalTransfers: 0,
};

/** Las notas al pie: una por sección, todas opcionales. */
export const NOTE_SECTIONS = [
  { key: "summary", label: "Vista general" },
  { key: "income", label: "Contribuciones al Fondo" },
  { key: "expenses", label: "Gastos del período" },
  { key: "funds", label: "Estado de los Fondos" },
  { key: "accounts", label: "Estado de las Cuentas" },
  { key: "contributions", label: "Cantidad de aportes (gráfico)" },
  { key: "localFund", label: "Estado del Fondo Local (gráfico)" },
  { key: "budget", label: "Presupuesto vs. ejecutado" },
  { key: "destination", label: "Destino de los Fondos" },
] as const;

export type NoteKey = (typeof NOTE_SECTIONS)[number]["key"];

/** Tonos disponibles para las etiquetas de "Destino de los Fondos". */
export const DESTINATION_TONES = [
  { key: "gold", label: "Neutro" },
  { key: "green", label: "Al día / hecho" },
  { key: "teal", label: "En estudio" },
  { key: "rose", label: "Meta / pendiente" },
] as const;

export type DestinationTone = (typeof DESTINATION_TONES)[number]["key"];

export type ReportDestinationItem = {
  label: string;
  badge: string;
  amount: string;
  tone: DestinationTone;
};

export type ReportGoal = {
  title: string;
  subtitle: string;
  monthly: string;
  annual: string;
  covered: string;
  note: string;
};

export type ReportEditorial = {
  notes: Partial<Record<NoteKey, string>>;
  destination: ReportDestinationItem[];
  goal: ReportGoal | null;
  quote: { text: string; source: string } | null;
  signature: { name: string; role: string } | null;
  /** Los gráficos y el presupuesto se pueden apagar: en el primer mes
   *  del año no dicen nada todavía. */
  showContributionsChart: boolean;
  showLocalFundChart: boolean;
  showBudget: boolean;
};

export const EMPTY_EDITORIAL: ReportEditorial = {
  notes: {},
  destination: [],
  goal: null,
  quote: null,
  signature: null,
  showContributionsChart: true,
  showLocalFundChart: true,
  showBudget: true,
};

// ─── Saneado ─────────────────────────────────────────────────────
// El editorial viaja por un hidden input del form y el snapshot vuelve
// de una columna jsonb: nada de eso se toma como confiable. Se copia
// campo por campo con el tipo esperado y el resto se descarta.

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const NOTE_KEYS = NOTE_SECTIONS.map((s) => s.key) as readonly NoteKey[];
const TONE_KEYS = DESTINATION_TONES.map((t) => t.key) as readonly DestinationTone[];

function toneOf(v: unknown): DestinationTone {
  const s = str(v) as DestinationTone;
  return TONE_KEYS.includes(s) ? s : "gold";
}

export function sanitizeReportEditorial(raw: unknown): ReportEditorial {
  const o = obj(raw);
  const notesRaw = obj(o.notes);
  const notes: Partial<Record<NoteKey, string>> = {};
  for (const key of NOTE_KEYS) {
    const text = str(notesRaw[key]);
    if (text) notes[key] = text;
  }

  const destination: ReportDestinationItem[] = arr(o.destination)
    .map((it) => obj(it))
    .map((it) => ({
      label: str(it.label),
      badge: str(it.badge),
      amount: str(it.amount),
      tone: toneOf(it.tone),
    }))
    .filter((it) => it.label.length > 0);

  const goalRaw = obj(o.goal);
  const goal: ReportGoal = {
    title: str(goalRaw.title),
    subtitle: str(goalRaw.subtitle),
    monthly: str(goalRaw.monthly),
    annual: str(goalRaw.annual),
    covered: str(goalRaw.covered),
    note: str(goalRaw.note),
  };

  const quoteRaw = obj(o.quote);
  const quote = { text: str(quoteRaw.text), source: str(quoteRaw.source) };

  const sigRaw = obj(o.signature);
  const signature = { name: str(sigRaw.name), role: str(sigRaw.role) };

  return {
    notes,
    destination,
    // La meta se muestra solo si tiene título: es lo que la nombra.
    goal: goal.title ? goal : null,
    quote: quote.text ? quote : null,
    signature: signature.name ? signature : null,
    showContributionsChart: bool(o.showContributionsChart, true),
    showLocalFundChart: bool(o.showLocalFundChart, true),
    showBudget: bool(o.showBudget, true),
  };
}

export function sanitizeReportSnapshot(raw: unknown): ReportSnapshot {
  const o = obj(raw);
  const money = (v: unknown): ReportMoney[] =>
    arr(v)
      .map((m) => obj(m))
      .map((m) => ({ currency: str(m.currency), amount: num(m.amount) }))
      .filter((m) => m.currency.length > 0);
  const balances = (v: unknown): ReportBalanceRow[] =>
    arr(v)
      .map((b) => obj(b))
      .map((b) => ({
        label: str(b.label),
        currency: str(b.currency),
        amount: num(b.amount),
      }));

  const budgetRaw = obj(o.budget);
  const budgetLines: ReportBudgetLine[] = arr(budgetRaw.lines)
    .map((l) => obj(l))
    .map((l) => ({
      category: str(l.category),
      icon: str(l.icon) || "default",
      planned: num(l.planned),
      actual: num(l.actual),
      linked: bool(l.linked, false),
    }));

  return {
    from: str(o.from),
    to: str(o.to),
    bahaiYear: typeof o.bahaiYear === "number" ? o.bahaiYear : null,
    income: money(o.income),
    incomeCount: num(o.incomeCount),
    receiptFrom: typeof o.receiptFrom === "number" ? o.receiptFrom : null,
    receiptTo: typeof o.receiptTo === "number" ? o.receiptTo : null,
    receipts: arr(o.receipts)
      .map((r) => obj(r))
      .map((r) => ({
        number: typeof r.number === "number" ? r.number : null,
        date: str(r.date),
        amount: num(r.amount),
        currency: str(r.currency),
        count: num(r.count),
        fund: str(r.fund) || null,
      })),
    expenses: money(o.expenses),
    expenseLines: arr(o.expenseLines)
      .map((l) => obj(l))
      .map((l) => ({
        label: str(l.label),
        category: str(l.category) || null,
        fund: str(l.fund) || null,
        amount: num(l.amount),
        currency: str(l.currency),
        date: str(l.date),
      })),
    result: money(o.result),
    byFund: balances(o.byFund),
    byAccount: balances(o.byAccount),
    months: arr(o.months)
      .map((m) => obj(m))
      .map((m) => ({
        key: str(m.key),
        label: str(m.label),
        contributions: num(m.contributions),
        localFundBalance: num(m.localFundBalance),
      })),
    localFund: str(obj(o.localFund).name)
      ? {
          name: str(obj(o.localFund).name),
          currency: str(obj(o.localFund).currency) || "UYU",
        }
      : null,
    budget: str(budgetRaw.period)
      ? { period: str(budgetRaw.period), lines: budgetLines }
      : null,
    internalTransfers: num(o.internalTransfers),
  };
}

// ─── Formato ─────────────────────────────────────────────────────

/** Monto sin decimales cuando terminan en ".00" — así se leen los
 *  informes de la planilla ("$ 15.000"), pero sin perder centavos. */
export function fmtAmount(amount: number, currency?: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const decimals = Number.isInteger(rounded) ? 0 : 2;
  const n = rounded.toLocaleString("es-UY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "USD" ? "US$ " : "$ ";
  return `${symbol}${n}`;
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTHS_ES_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function monthLabel(month1to12: number): string {
  return MONTHS_ES_SHORT[month1to12 - 1] ?? "";
}

/** "2026-08-23" → "23 de agosto de 2026". Parseo manual a propósito:
 *  `new Date("2026-08-23")` es UTC y en Montevideo cae un día antes. */
export function fmtLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!y || !m || !d) return iso;
  const day = d === 1 ? "1.º" : String(d);
  return `${day} de ${MONTHS_ES[m - 1]} de ${y}`;
}

/** "2026-08-23" → "23 de agosto". */
export function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!m || !d) return iso;
  const day = d === 1 ? "1.º" : String(d);
  return `${day} de ${MONTHS_ES[m - 1]}`;
}

/** La moneda protagonista del informe es la que tuvo más movimiento:
 *  casi siempre UYU, pero no lo damos por sentado. */
export function primaryCurrency(rows: ReportMoney[]): string {
  let best = "UYU";
  let bestAbs = -1;
  for (const r of rows) {
    const abs = Math.abs(r.amount);
    if (abs > bestAbs) {
      best = r.currency;
      bestAbs = abs;
    }
  }
  return best;
}

/** Separa la moneda protagonista del resto, que va como nota al pie. */
export function splitByCurrency(
  rows: ReportMoney[],
  main: string
): { main: ReportMoney | null; rest: ReportMoney[] } {
  const mainRow = rows.find((r) => r.currency === main) ?? null;
  return { main: mainRow, rest: rows.filter((r) => r.currency !== main) };
}
