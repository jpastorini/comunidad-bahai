import { BahaiStar } from "@/components/BahaiStar";
import { categoryMeta } from "@/lib/budget";
import {
  CADENCE_LABEL,
  PACE_COPY,
  fmtPercent,
  fmtRound,
  goalProgress,
  paceGap,
  paceVerdict,
  type ProgressCategory,
  type ProgressData,
  type ProgressGoal,
  type ProgressMonth,
} from "@/lib/treasury-progress-content";
import { fmtDayMonth, fmtLongDate } from "@/lib/treasury-report-content";

/**
 * Tablero de progreso contra el presupuesto y las metas.
 *
 * Tres bloques, en orden de "qué necesito saber primero":
 *
 *   1. ¿Alcanza? — lo recibido contra lo que el presupuesto exige, con
 *      una marca en el punto del ejercicio en que estamos.
 *   2. ¿En qué se aplica? — ejecutado sobre presupuestado por categoría,
 *      cada una con su propia marca de pauta.
 *   3. ¿Y las metas? — lo logrado sobre lo buscado.
 *
 * Todo lo que se dibuja acá viene calculado (lib/treasury-progress.ts);
 * el componente no suma nada. Es un componente de servidor a propósito:
 * no hay interacción, así que no manda JavaScript al navegador.
 *
 * La regla de diseño: **cada barra trae su referencia dibujada**. Sin la
 * marca de pauta, un porcentaje solo no se puede interpretar.
 */

export function ProgressBoard({
  data,
  localityName,
  compact = false,
}: {
  data: ProgressData;
  localityName?: string;
  /** Versión para el celular de la comunidad: menos texto de apoyo. */
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PaceBlock data={data} compact={compact} />
      {data.months.length > 1 && <MonthsBlock data={data} compact={compact} />}
      {data.categories.length > 0 && (
        <CategoriesBlock data={data} compact={compact} />
      )}
      {data.goals.length > 0 && <GoalsBlock data={data} compact={compact} />}
      {data.balances.length > 0 && !compact && <BalancesBlock data={data} />}
      <p className="px-1 text-[11px] leading-relaxed text-muted">
        Ejercicio {data.bahaiYear} E.B., de Riḍván a Riḍván:{" "}
        {fmtLongDate(data.from)} al {fmtLongDate(data.to)} · cifras al{" "}
        {fmtLongDate(data.asOf)}
        {localityName && ` · Asamblea Espiritual Local de ${localityName}`}
      </p>
    </div>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────

function Block({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-black/[0.05] bg-card p-4 shadow-card-elevated sm:p-6">
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-dark">
          <BahaiStar size={10} color="#C4A235" />
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-[21px] font-semibold leading-tight text-dark sm:text-[25px]">
          {title}
        </h2>
        {hint && <p className="mt-1 text-[12px] leading-snug text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const TONE_BAR: Record<string, string> = {
  green: "bg-green",
  gold: "bg-gold",
  rose: "bg-rose-500",
  muted: "bg-muted",
};

const TONE_TEXT: Record<string, string> = {
  green: "text-green",
  gold: "text-gold-dark",
  rose: "text-rose-700",
  muted: "text-muted",
};

/**
 * Barra con la marca de pauta encima. `value` y `reference` son
 * fracciones de 0 a 1; la marca es una línea vertical, no un color, para
 * que se lea como "acá tendríamos que estar".
 */
function PaceBar({
  value,
  reference,
  tone,
  height = "h-4",
}: {
  value: number;
  reference?: number;
  tone: string;
  height?: string;
}) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  const ref = reference === undefined ? null : Math.min(Math.max(reference, 0), 1) * 100;
  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-black/[0.07] ${height}`}>
      <div
        className={`h-full rounded-full ${TONE_BAR[tone] ?? TONE_BAR.gold}`}
        style={{ width: `${pct}%` }}
      />
      {ref !== null && (
        <span
          aria-hidden="true"
          className="absolute top-0 h-full w-[2px] bg-dark/55"
          style={{ left: `calc(${ref}% - 1px)` }}
        />
      )}
    </div>
  );
}

// ─── 1 · ¿Alcanza? ───────────────────────────────────────────────

function PaceBlock({ data, compact }: { data: ProgressData; compact: boolean }) {
  const verdict = paceVerdict(data);
  const copy = PACE_COPY[verdict];
  const gap = paceGap(data);
  const budget = data.budget;

  const value = budget && budget.totalPlanned > 0 ? data.received / budget.totalPlanned : 0;

  return (
    <Block
      eyebrow="Lo primero"
      title="¿Alcanza para el plan del año?"
      hint={
        compact
          ? undefined
          : "La barra es lo recibido sobre lo que el presupuesto necesita en todo el ejercicio. La línea vertical marca en qué punto del año estamos: si la barra la pasó, el plan va financiado."
      }
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-display text-[32px] font-semibold leading-none text-dark sm:text-[40px]">
            {fmtRound(data.received)}
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {data.receivedCount}{" "}
            {data.receivedCount === 1 ? "aporte recibido" : "aportes recibidos"}
            {data.receivedOther.length > 0 && (
              <>
                {" · "}
                {data.receivedOther
                  .map((m) => `${fmtRound(m.amount, m.currency)} ${m.currency}`)
                  .join(" · ")}
              </>
            )}
          </div>
        </div>
        {budget && (
          <div className="text-right">
            <div className="text-[12px] text-muted">Presupuesto {budget.period}</div>
            <div className="font-display text-[20px] font-semibold text-dark">
              {fmtRound(budget.totalPlanned)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
        <PaceBar value={value} reference={data.elapsed.fraction} tone={copy.tone} height="h-5" />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
          <span className={`font-bold ${TONE_TEXT[copy.tone]}`}>
            ● {copy.label}
            {gap !== null && gap !== 0 && (
              <>
                {" · "}
                {gap > 0 ? "+ " : "− "}
                {fmtRound(Math.abs(gap))} contra la pauta
              </>
            )}
          </span>
          <span className="text-muted">
            Transcurrió el {fmtPercent(data.elapsed.fraction)} del ejercicio (
            {data.elapsed.daysElapsed} de {data.elapsed.daysTotal} días)
          </span>
        </div>
      </div>

      {budget ? (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/[0.06] pt-4 sm:grid-cols-3">
          <Figure
            label="Necesario por mes bahá'í"
            value={fmtRound(budget.requiredPerMonth)}
            meta="Presupuesto ÷ 19 meses"
          />
          <Figure
            label="Debería haber entrado"
            value={fmtRound(budget.expectedToDate)}
            meta={`Al ${fmtDayMonth(data.asOf)}`}
          />
          <Figure
            label="Aplicado del presupuesto"
            value={fmtRound(data.spent)}
            meta={
              budget.totalPlanned > 0
                ? `${fmtPercent(data.spent / budget.totalPlanned)} del plan`
                : ""
            }
          />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-black/15 bg-bg/50 p-4 text-center text-[12.5px] text-muted">
          Todavía no hay un presupuesto cargado para este ejercicio, así que no
          hay pauta contra la que comparar. Se puede armar en el Plan de
          Presupuesto.
        </p>
      )}
    </Block>
  );
}

function Figure({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-0.5 font-display text-[18px] font-semibold text-dark">
        {value}
      </div>
      {meta && <div className="text-[11px] text-muted">{meta}</div>}
    </div>
  );
}

// ─── 2 · Mes a mes ───────────────────────────────────────────────

/** "Mashíyyat" → "Mas". Los nombres completos no entran en un eje de 20
 *  divisiones y las tres primeras letras alcanzan para distinguirlos. */
function shortMonth(name: string): string {
  return name.slice(0, 3);
}

/** Las barras llegan como máximo a esta fracción del área del gráfico:
 *  el resto es el aire donde se escribe el monto arriba de la barra. */
const BAR_CEILING = 0.82;

function MonthsBlock({ data, compact }: { data: ProgressData; compact: boolean }) {
  const required = data.budget?.requiredPerMonth ?? 0;
  const max = Math.max(...data.months.map((m) => m.received), required, 1);
  const scale = (v: number) => (v / max) * BAR_CEILING * 100;
  const requiredPct = scale(required);
  // Sobre los diez tramos las columnas del celular quedan más angostas
  // que el monto, así que ahí el número se muestra solo en pantalla
  // grande; en el celular la barra y el eje siguen siendo legibles.
  const dense = data.months.length > 10;

  return (
    <Block
      eyebrow="Mes a mes"
      title="Cada Fiesta, cuánto entró"
      hint={
        compact
          ? undefined
          : "Una barra por mes bahá'í. La línea punteada es lo que hace falta por mes para sostener el presupuesto: las barras que no la alcanzan son los meses en que el Fondo quedó corto."
      }
    >
      <div className="flex h-[190px] w-full flex-col sm:h-[240px]">
        {/* Área del gráfico: el 100 % de su alto es la escala, y las
            etiquetas de los meses viven afuera para que la geometría de
            las barras y de la línea de referencia sea exacta. */}
        <div className="relative min-h-0 flex-1">
          {required > 0 && (
            <>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 border-t-2 border-dashed border-gold-dark/55"
                style={{ bottom: `${requiredPct}%` }}
              />
              <span
                className="absolute right-0 mb-0.5 rounded bg-gold/15 px-1.5 py-0.5 text-[9.5px] font-bold text-gold-dark sm:text-[10.5px]"
                style={{ bottom: `${requiredPct}%` }}
              >
                necesario por mes: {fmtRound(required)}
              </span>
            </>
          )}
          <div className="absolute inset-0 flex items-end gap-1 sm:gap-2.5">
            {data.months.map((m) => (
              <MonthBar
                key={m.key}
                month={m}
                pct={scale(m.received)}
                withRequired={required > 0}
                dense={dense}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-1 border-t border-black/10 pt-1.5 sm:gap-2.5">
          {data.months.map((m) => (
            <div
              key={m.key}
              className="min-w-0 flex-1 truncate text-center text-[9.5px] font-semibold text-muted sm:text-[11px]"
              title={`${m.label} · ${fmtDayMonth(m.from)} al ${fmtDayMonth(m.to)}`}
            >
              {shortMonth(m.label)}
            </div>
          ))}
        </div>
      </div>
    </Block>
  );
}

function MonthBar({
  month,
  pct,
  withRequired,
  dense,
}: {
  month: ProgressMonth;
  pct: number;
  withRequired: boolean;
  dense: boolean;
}) {
  // Un mes cerrado que no llegó al necesario se marca; el mes en curso
  // no, porque todavía puede llegar.
  const short =
    withRequired && !month.inProgress && month.received < month.required;
  return (
    <div className="relative flex h-full min-w-0 flex-1 items-end">
      <div
        className={`w-full rounded-t ${
          month.inProgress
            ? "bg-gold/40"
            : short
              ? "bg-rose-400/75"
              : "bg-green/70"
        }`}
        style={{ height: `${pct}%` }}
        title={`${month.label}: ${fmtRound(month.received)} · necesario ${fmtRound(
          month.required
        )}`}
      />
      {/* El monto va sin símbolo de moneda: en una columna de 35 px el
          "$ " es lo primero que sobra, y el eje ya dice en qué moneda es. */}
      <span
        className={`absolute inset-x-0 whitespace-nowrap text-center text-[9px] font-bold leading-none tabular-nums text-dark sm:text-[10.5px] ${
          dense ? "hidden sm:block" : ""
        }`}
        style={{ bottom: `calc(${pct}% + 3px)` }}
      >
        {month.received > 0 ? Math.round(month.received).toLocaleString("es-UY") : "—"}
      </span>
    </div>
  );
}

// ─── 3 · Categorías ──────────────────────────────────────────────

function CategoriesBlock({
  data,
  compact,
}: {
  data: ProgressData;
  compact: boolean;
}) {
  const linked = data.categories.filter((c) => c.linked);
  const unlinked = data.categories.filter((c) => !c.linked);

  return (
    <Block
      eyebrow="En qué se aplica"
      title="Presupuesto por categoría"
      hint={
        compact
          ? undefined
          : "Cada barra es lo aplicado sobre lo presupuestado, y la línea vertical vuelve a marcar el punto del ejercicio. Una barra muy corta no siempre es buena noticia: puede querer decir que el plan de esa categoría no se hizo."
      }
    >
      <div className="flex flex-col gap-3.5">
        {linked.map((c) => (
          <CategoryRow key={c.id} item={c} reference={data.elapsed.fraction} />
        ))}
      </div>
      {unlinked.length > 0 && (
        <p className="mt-4 border-t border-black/[0.06] pt-3 text-[11.5px] leading-snug text-muted">
          Sin vincular al libro:{" "}
          <strong className="text-dark">
            {unlinked.map((c) => c.category).join(", ")}
          </strong>
          . Se presupuestaron {fmtRound(unlinked.reduce((s, c) => s + c.planned, 0))}{" "}
          que no se pueden comparar hasta que la Asamblea indique con qué rubro
          del libro se ejecutan.
        </p>
      )}
    </Block>
  );
}

function CategoryRow({
  item,
  reference,
}: {
  item: ProgressCategory;
  reference: number;
}) {
  const meta = categoryMeta(item.icon);
  const fraction = item.planned > 0 ? item.actual / item.planned : 0;
  const over = item.actual > item.planned;
  // Muy por detrás de la pauta: menos de la mitad de lo que correspondería.
  const behind = !over && fraction < reference * 0.5;
  const tone = over ? "rose" : behind ? "gold" : "green";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-dark">
          <span aria-hidden="true">{meta.emoji}</span>
          <span className="truncate">{item.category}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-[12.5px] font-bold">
          <span className={over ? "text-rose-700" : "text-dark"}>
            {fmtRound(item.actual)}
          </span>
          <span className="font-normal text-muted"> / {fmtRound(item.planned)}</span>
        </span>
      </div>
      <PaceBar value={fraction} reference={reference} tone={tone} height="h-2.5" />
      {over && (
        <div className="mt-0.5 text-[11px] font-semibold text-rose-700">
          Excedido en {fmtRound(item.actual - item.planned)}
        </div>
      )}
    </div>
  );
}

// ─── 4 · Metas ───────────────────────────────────────────────────

function GoalsBlock({ data, compact }: { data: ProgressData; compact: boolean }) {
  const withNumber = data.goals.filter((g) => g.target !== null);
  const withoutNumber = data.goals.filter((g) => g.target === null);

  return (
    <Block
      eyebrow="Metas de la Asamblea"
      title="Lo que nos propusimos"
      hint={
        compact
          ? undefined
          : "Las metas con cifra se miden contra los movimientos del libro. Las que no tienen cifra son gestiones en curso y se informan por su estado."
      }
    >
      <div className="flex flex-col gap-4">
        {withNumber.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </div>

      {withoutNumber.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-black/[0.06] pt-4">
          {withoutNumber.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-dark">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold ring-4 ring-gold/15" />
                <span className="truncate">{g.title}</span>
              </span>
              {g.badge && (
                <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-dark">
                  {g.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Block>
  );
}

function GoalRow({ goal }: { goal: ProgressGoal }) {
  const fraction = goalProgress(goal);
  const lograda = goal.status === "lograda";
  const tone = lograda
    ? "green"
    : fraction === null
      ? "muted"
      : fraction >= 0.999
        ? "green"
        : fraction >= 0.5
          ? "gold"
          : "rose";

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-dark">
          {goal.title}
          {lograda && (
            <span className="ml-2 rounded-full border border-green/30 bg-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green">
              Lograda
            </span>
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-[12.5px] font-bold text-dark">
          {goal.measurable ? (
            <>
              {fmtRound(goal.actual, goal.currency)}
              <span className="font-normal text-muted">
                {" / "}
                {fmtRound(goal.targetToDate ?? 0, goal.currency)}
              </span>
            </>
          ) : (
            <span className="font-normal italic text-muted">
              objetivo {fmtRound(goal.target ?? 0, goal.currency)}
            </span>
          )}
        </span>
      </div>

      {fraction !== null ? (
        <PaceBar value={fraction} tone={tone} height="h-2.5" />
      ) : (
        <div className="h-2.5 w-full rounded-full border border-dashed border-black/15" />
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
        <span>
          {fmtRound(goal.target ?? 0, goal.currency)} {CADENCE_LABEL[goal.cadence]}
        </span>
        {fraction !== null && (
          <span className={`font-bold ${TONE_TEXT[tone]}`}>
            · {fmtPercent(fraction)} de lo que corresponde a hoy
          </span>
        )}
        {!goal.measurable && (
          <span className="italic">
            · falta indicar con qué rubro del libro se mide
          </span>
        )}
        {goal.description && <span className="w-full">{goal.description}</span>}
      </div>
    </div>
  );
}

// ─── 5 · Saldos ──────────────────────────────────────────────────

function BalancesBlock({ data }: { data: ProgressData }) {
  return (
    <Block
      eyebrow="Al cierre"
      title="Disponible por fondo"
      hint="La plata está «coloreada» por fondo: cada uno tiene su destino y no se mezcla con los otros ni entre monedas."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.balances.map((b) => (
          <div
            key={`${b.label}|${b.currency}`}
            className="rounded-xl border border-black/[0.06] bg-bg/40 px-3 py-2.5"
          >
            <div className="truncate text-[11px] text-muted">{b.label}</div>
            <div
              className={`tabular-nums text-[15px] font-semibold ${
                b.amount < 0 ? "text-rose-700" : "text-dark"
              }`}
            >
              {fmtRound(b.amount, b.currency)}
              <span className="ml-1 text-[10.5px] font-normal text-muted">
                {b.currency}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Block>
  );
}
