import { categoryMeta, fmtUYU } from "@/lib/budget";

export type BudgetViewItem = {
  id: string;
  category: string;
  icon: string;
  /** Presupuesto de este año. */
  planned: number;
  /** Gastado el año pasado (referencia). */
  spent: number;
};

/**
 * Vista de solo-lectura del presupuesto vigente (status 'active') para
 * los miembros. Muestra, por categoría, lo gastado el año pasado (como
 * referencia) y el monto presupuestado para este año. Solo recibe
 * categorías con presupuesto > 0.
 */
export function BudgetView({
  period,
  items,
}: {
  period: string;
  items: BudgetViewItem[];
}) {
  if (items.length === 0) return null;

  const totalThisYear = items.reduce((s, i) => s + i.planned, 0);
  const totalLastYear = items.reduce((s, i) => s + i.spent, 0);

  return (
    <section className="mb-3.5">
      <h2 className="mb-2.5 text-[14px] font-semibold text-dark">
        Presupuesto del año
      </h2>
      <div className="rounded-2xl bg-card p-4 shadow-card-soft">
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-[rgba(42,63,143,0.06)] pb-3">
          <div>
            <div className="text-[11px] text-muted">{period}</div>
            <div className="text-[15px] font-semibold text-dark">
              {fmtUYU(totalThisYear)}{" "}
              <span className="font-body text-[11.5px] font-normal text-muted">
                presupuestado
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] text-muted">Año pasado (ref.)</div>
            <div className="text-[12.5px] font-semibold text-muted">
              {fmtUYU(totalLastYear)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {items.map((it) => {
            const meta = categoryMeta(it.icon);
            return (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-dark">
                  <span aria-hidden>{meta.emoji}</span>
                  <span className="truncate">{it.category}</span>
                </span>
                <span className="shrink-0 text-right text-[11px]">
                  <span className="text-muted">
                    Año pasado {fmtUYU(it.spent)}
                  </span>
                  <span className="mx-1 text-muted/50">·</span>
                  <span className="font-semibold text-dark">
                    Este año {fmtUYU(it.planned)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
