import { RULE_GROUPS, ruleApplies, type AuditLocalityKind, type Severity } from "@/lib/treasury-audit";

type RuleState =
  | { kind: "ok" }
  | { kind: "pending"; n: number; severity: Severity }
  | { kind: "dispatched" }
  | { kind: "failed" }
  | { kind: "off" };

const PENDING_TONE: Record<Severity, { dot: string; text: string }> = {
  alta: { dot: "bg-rose-400", text: "text-rose-600" },
  media: { dot: "bg-amber-400", text: "text-amber-700" },
  baja: { dot: "bg-slate-400", text: "text-slate-500" },
};

/**
 * "Qué se revisó": todas las reglas, por tema, con lo que dio cada una en
 * esta corrida. Es el pie del informe y va chico a propósito: los
 * hallazgos son lo que se lee; esto es para quien quiere saber qué se
 * comprobó y qué quedó sin correr (apagada en esta comunidad o rota).
 */
export function RulesChecked({
  kind,
  pendingCodes,
  dispatchedCodes,
  failedCodes,
}: {
  kind: AuditLocalityKind;
  /** code → cuántos pendientes y de qué gravedad. */
  pendingCodes: Map<string, { n: number; severity: Severity }>;
  dispatchedCodes: Set<string>;
  failedCodes: Set<string>;
}) {
  const stateOf = (rule: (typeof RULE_GROUPS)[number]["rules"][number]): RuleState => {
    if (!ruleApplies(rule, kind)) return { kind: "off" };
    if (failedCodes.has(rule.code)) return { kind: "failed" };
    const p = pendingCodes.get(rule.code);
    if (p) return { kind: "pending", ...p };
    if (dispatchedCodes.has(rule.code)) return { kind: "dispatched" };
    return { kind: "ok" };
  };

  const all = RULE_GROUPS.flatMap((g) => g.rules.map(stateOf));
  const tally = {
    ok: all.filter((s) => s.kind === "ok" || s.kind === "dispatched").length,
    pending: all.filter((s) => s.kind === "pending").length,
    off: all.filter((s) => s.kind === "off").length,
    failed: all.filter((s) => s.kind === "failed").length,
  };
  const ran = all.length - tally.off;

  return (
    <section className="mt-8 rounded-2xl border border-black/[0.04] bg-card/60 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
          Qué se revisó
        </h2>
        <p className="text-[11.5px] text-muted">
          {ran} reglas corridas · <span className="text-green">{tally.ok} sin pendientes</span>
          {tally.pending > 0 && <> · {tally.pending} con pendientes</>}
          {tally.failed > 0 && <span className="text-rose-600"> · {tally.failed} no pudieron correr</span>}
          {tally.off > 0 && <> · {tally.off} no aplican a esta comunidad</>}
        </p>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {RULE_GROUPS.map((g) => (
          <div key={g.letter} className="min-w-0">
            <h3 className="mb-1.5 flex items-baseline gap-1.5 border-b border-black/[0.05] pb-1 text-[11.5px] font-semibold text-dark">
              <span className="font-display text-[13px] font-semibold text-gold-dark">{g.letter}</span>
              {g.title}
            </h3>
            <ul className="space-y-[3px]">
              {g.rules.map((rule) => {
                const s = stateOf(rule);
                return (
                  <li
                    key={rule.code}
                    title={`${rule.code} · ${rule.basis} · gravedad ${rule.severity}`}
                    className={`flex items-baseline gap-2 text-[11.5px] leading-snug ${
                      s.kind === "off" ? "text-muted/60" : "text-dark/80"
                    }`}
                  >
                    <Dot s={s} />
                    <span className={`min-w-0 flex-1 ${s.kind === "off" ? "line-through decoration-black/20" : ""}`}>
                      {rule.label}
                    </span>
                    <Tag s={s} />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Una regla en verde no tiene nada pendiente en el período. Lo tachado no corre
        en esta comunidad. En la computadora, pasá el mouse por una regla para ver su
        código, contra qué se mide y su gravedad.
      </p>
    </section>
  );
}

function Dot({ s }: { s: RuleState }) {
  const cls =
    s.kind === "ok" || s.kind === "dispatched"
      ? "bg-green/70"
      : s.kind === "pending"
        ? PENDING_TONE[s.severity].dot
        : s.kind === "failed"
          ? "bg-rose-500"
          : "bg-black/10";
  return <span aria-hidden className={`relative top-[-1px] h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function Tag({ s }: { s: RuleState }) {
  if (s.kind === "pending")
    return (
      <span className={`shrink-0 tabular-nums text-[10.5px] font-semibold ${PENDING_TONE[s.severity].text}`}>
        {s.n}
      </span>
    );
  if (s.kind === "dispatched")
    return <span className="shrink-0 text-[10.5px] text-muted">despachado</span>;
  if (s.kind === "failed")
    return <span className="shrink-0 text-[10.5px] font-semibold text-rose-600">no corrió</span>;
  return null;
}
