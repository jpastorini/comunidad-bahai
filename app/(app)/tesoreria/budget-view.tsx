import { categoryMeta, fmtUYU } from "@/lib/budget";

export type BudgetViewItem = {
  id: string;
  category: string;
  icon: string;
  planned: number;
  spent: number;
};

/**
 * Vista de solo-lectura del presupuesto vigente (status 'active') para
 * los miembros. Muestra la ejecución total y el avance por categoría.
 * Solo recibe categorías con meta > 0 (las de $0 no se presupuestaron).
 */
export function BudgetView({
  period,
  items,
}: {
  period: string;
  items: BudgetViewItem[];
}) {
  if (items.length === 0) return null;

  const totalPlanned = items.reduce((s, i) => s + i.planned, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const pct = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0;

  return (
    <section className="mb-3.5">
      <h2 className="mb-2.5 text-[14px] font-semibold text-dark">
        Presupuesto del año
      </h2>
      <div className="rounded-2xl bg-card p-4 shadow-card-soft">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] text-muted">{period}</span>
          <span className="text-[11.5px] font-semibold text-terra">
            {pct}% ejecutado
          </span>
        </div>
        <div className="text-[15px] font-semibold text-dark">
          {fmtUYU(totalSpent)}{" "}
          <span className="font-body text-[11.5px] font-normal text-muted">
            de {fmtUYU(totalPlanned)} planificado
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-terra/10">
          <div
            className="h-full rounded-full bg-terra transition-[width] duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {items.map((it) => {
            const meta = categoryMeta(it.icon);
            const cpct = it.planned > 0 ? (it.spent / it.planned) * 100 : 0;
            const over = cpct > 100;
            return (
              <div key={it.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-dark">
                    <span aria-hidden>{meta.emoji}</span>
                    {it.category}
                  </span>
                  <span
                    className={`text-[10.5px] ${
                      over ? "font-bold text-rose-600" : "text-muted"
                    }`}
                  >
                    {fmtUYU(it.spent)} / {fmtUYU(it.planned)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                  style={{ background: `${meta.color}15` }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(cpct, 100)}%`,
                      background: over
                        ? "linear-gradient(90deg,#C2185B,#E91E63)"
                        : meta.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
