/**
 * Progreso contra el presupuesto y las metas — tipos y helpers puros.
 *
 * Igual que treasury-report-content.ts: vive aparte de la capa de datos
 * para que el componente de cliente que dibuja el tablero pueda importar
 * los tipos sin arrastrar las queries al bundle.
 *
 * La idea que ordena todo el módulo: **la referencia se dibuja, no se
 * calcula mentalmente**. Un 43 % ejecutado no dice nada solo; un 43 %
 * ejecutado con una marca en el 65 % del ejercicio transcurrido dice
 * "vamos lentos" sin que nadie tenga que pensar. Por eso casi todo lo
 * que se calcula acá viene en pares: lo real y la pauta.
 */

/**
 * El presupuesto se arma en pesos (la columna `planned_amount` de
 * treasury_budget_items no tiene moneda). Los dólares del libro se
 * informan al costado, nunca sumados.
 */
export const BUDGET_CURRENCY = "UYU";

export type ProgressMoney = { currency: string; amount: number };

/** Un tramo de mes bahá'í del ejercicio, con lo recibido y lo requerido. */
export type ProgressMonth = {
  key: string;
  /** Nombre del mes bahá'í, abreviado para el eje. */
  label: string;
  from: string;
  to: string;
  /** El primer y el último tramo del ejercicio son parciales (el año
   *  arranca el 13 de Jalál), así que su requerido es proporcional. */
  partial: boolean;
  received: number;
  contributions: number;
  /** Cuánto tendría que haber entrado en este tramo para sostener el
   *  presupuesto. 0 si no hay presupuesto cargado. */
  required: number;
  /** El tramo todavía no terminó: la barra se muestra atenuada. */
  inProgress: boolean;
};

export type ProgressCategory = {
  id: string;
  category: string;
  icon: string;
  planned: number;
  actual: number;
  /** false = la línea no tiene rubro del libro vinculado; no se puede
   *  calcular su ejecutado y se informa como tal, nunca como cero. */
  linked: boolean;
};

export type GoalCadence = "mensual" | "anual" | "unica";
export type GoalDirection = "gasto" | "ingreso";
export type GoalStatus = "activa" | "lograda" | "archivada";

export type ProgressGoal = {
  id: string;
  title: string;
  description: string | null;
  badge: string | null;
  status: GoalStatus;
  cadence: GoalCadence;
  direction: GoalDirection;
  currency: string;
  /** NULL = meta sin cifra: se muestra como tarjeta de estado, sin barra. */
  target: number | null;
  /** Lo aplicado (o recibido) en el ejercicio para el rubro vinculado. */
  actual: number;
  /** El objetivo acumulado a la fecha. En una meta mensual crece con el
   *  ejercicio; en una anual es el objetivo entero. */
  targetToDate: number | null;
  /** false = la meta tiene cifra pero no declara rubro del libro, así que
   *  no hay con qué medirla. */
  measurable: boolean;
};

export type ProgressData = {
  bahaiYear: number | null;
  /** Bordes del ejercicio (Riḍván a Riḍván) y fecha de corte. */
  from: string;
  to: string;
  asOf: string;
  elapsed: { fraction: number; daysElapsed: number; daysTotal: number };
  budget: {
    period: string;
    totalPlanned: number;
    /** Presupuesto dividido por los 19 meses bahá'ís del ejercicio. */
    requiredPerMonth: number;
    /** Lo que tendría que haber entrado a la fecha, si el año fuera
     *  parejo. Es la pauta. */
    expectedToDate: number;
  } | null;
  /** Contribuciones del ejercicio en la moneda del presupuesto. */
  received: number;
  receivedCount: number;
  /** Contribuciones en otras monedas: se informan, no se suman. */
  receivedOther: ProgressMoney[];
  /** Gastos del ejercicio en la moneda del presupuesto. */
  spent: number;
  months: ProgressMonth[];
  categories: ProgressCategory[];
  goals: ProgressGoal[];
  /** Saldo disponible por fondo al cierre, para el pie del tablero. */
  balances: { label: string; currency: string; amount: number }[];
};

// ─── Lecturas del estado ─────────────────────────────────────────

export type PaceVerdict = "adelantado" | "en_pauta" | "atrasado" | "sin_pauta";

/**
 * Cómo venimos. El margen de "en pauta" es del 5 % del presupuesto
 * anual: más fino que eso es ruido de calendario (una Fiesta que cayó
 * unos días antes o después) y encender una alarma por eso haría que la
 * pantalla mienta.
 */
export function paceVerdict(data: ProgressData): PaceVerdict {
  if (!data.budget || data.budget.totalPlanned <= 0) return "sin_pauta";
  const margin = data.budget.totalPlanned * 0.05;
  const diff = data.received - data.budget.expectedToDate;
  if (diff > margin) return "adelantado";
  if (diff < -margin) return "atrasado";
  return "en_pauta";
}

export const PACE_COPY: Record<
  PaceVerdict,
  { label: string; tone: "green" | "gold" | "rose" | "muted" }
> = {
  adelantado: { label: "Por encima de la pauta", tone: "green" },
  en_pauta: { label: "En pauta", tone: "gold" },
  atrasado: { label: "Por debajo de la pauta", tone: "rose" },
  sin_pauta: { label: "Sin presupuesto cargado", tone: "muted" },
};

/** Diferencia contra la pauta, con signo. */
export function paceGap(data: ProgressData): number | null {
  if (!data.budget) return null;
  return Math.round((data.received - data.budget.expectedToDate) * 100) / 100;
}

/** El avance de una meta, entre 0 y 1. NULL si no se puede medir. */
export function goalProgress(goal: ProgressGoal): number | null {
  if (!goal.measurable || !goal.targetToDate || goal.targetToDate <= 0) {
    return null;
  }
  return Math.min(Math.max(goal.actual / goal.targetToDate, 0), 1);
}

// ─── Formato ─────────────────────────────────────────────────────

/** Pesos sin centavos: en un tablero los centavos son ruido. */
export function fmtRound(amount: number, currency = BUDGET_CURRENCY): string {
  const symbol = currency === "USD" ? "US$ " : "$ ";
  return symbol + Math.round(amount).toLocaleString("es-UY");
}

export function fmtPercent(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

export const CADENCE_LABEL: Record<GoalCadence, string> = {
  mensual: "por mes bahá'í",
  anual: "en el ejercicio",
  unica: "meta única",
};

export const DIRECTION_LABEL: Record<GoalDirection, string> = {
  gasto: "Se mide por lo aplicado",
  ingreso: "Se mide por lo recibido",
};
