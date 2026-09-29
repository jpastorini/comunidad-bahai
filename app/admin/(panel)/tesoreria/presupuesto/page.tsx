import Link from "next/link";
import {
  Banner,
  Button,
  Card,
  Field,
  PageHeader,
  TextArea,
  TextInput,
} from "@/components/admin/ui";
import { IconArrowRight } from "@/components/Icons";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { treasuryYearForDate } from "@/lib/treasury-year";
import { createSupabaseServer } from "@/lib/supabase/server";
import { fmtUYU } from "@/lib/budget";
import { getGoals } from "@/lib/treasury-progress";
import { createBudgetAction } from "./actions";

export const revalidate = 60;

type BudgetRow = {
  id: string;
  period: string;
  bahai_year: number | null;
  status: "draft" | "active" | "closed";
  created_at: string;
};

type ItemRow = {
  budget_id: string;
  planned_amount: number;
  spent_amount: number;
};

const STATUS_META: Record<
  BudgetRow["status"],
  { label: string; className: string }
> = {
  draft: { label: "Borrador", className: "bg-bg text-muted" },
  active: { label: "Activo", className: "bg-green/15 text-green" },
  closed: { label: "Cerrado", className: "bg-gold/20 text-gold-dark" },
};

export default async function PresupuestoListPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const supabase = createSupabaseServer();

  // La RLS de treasury_budgets es select-all; filtramos por localidad acá.
  const { data: budgetsRaw } = await supabase
    .from("treasury_budgets")
    .select("id, period, bahai_year, status, created_at")
    .eq("locality_id", session.locality.id)
    .order("bahai_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const budgets = (budgetsRaw ?? []) as BudgetRow[];
  // Las metas son la otra mitad de este ítem del menú: se editan en su
  // subpantalla, acá se ven de un vistazo.
  const goals = await getGoals(supabase, session.locality.id);
  const activeGoals = goals.filter((g) => g.status === "activa");
  const achievedGoals = goals.filter((g) => g.status === "lograda");

  // Totales por presupuesto (solo categorías con meta > 0) en una query.
  const totalsByBudget = new Map<string, { planned: number; spent: number }>();
  if (budgets.length > 0) {
    const { data: itemsRaw } = await supabase
      .from("treasury_budget_items")
      .select("budget_id, planned_amount, spent_amount")
      .in(
        "budget_id",
        budgets.map((b) => b.id)
      );
    for (const it of (itemsRaw ?? []) as ItemRow[]) {
      if (Number(it.planned_amount) <= 0) continue;
      const acc = totalsByBudget.get(it.budget_id) ?? { planned: 0, spent: 0 };
      acc.planned += Number(it.planned_amount);
      acc.spent += Number(it.spent_amount);
      totalsByBudget.set(it.budget_id, acc);
    }
  }

  // Ejercicio contable en curso (Riḍván a Riḍván), propuesto como valor
  // del campo y no como placeholder: un año vacío dejaba el presupuesto
  // sin atar al progreso ni al informe.
  const currentBahaiYear =
    treasuryYearForDate(new Date().toISOString().slice(0, 10)) ?? 183;

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Presupuesto y metas"
        description="Lo que la Asamblea planea gastar en el ejercicio, por categoría, y lo que se propuso lograr. Las categorías en $0 no se cuentan en las metas del año."
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-semibold text-dark">
              Metas de la Asamblea
            </h2>
            <p className="mt-1 text-[12px] text-muted">
              Lo que la Asamblea se propuso, con el rubro del libro que lo mide.
              De acá salen las barras de progreso del tablero y del informe.
            </p>
            {goals.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">Todavía no hay metas cargadas.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {activeGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-[13px] text-dark">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span className="truncate">{g.title}</span>
                    {g.badge && (
                      <span className="shrink-0 rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                        {g.badge}
                      </span>
                    )}
                  </li>
                ))}
                {achievedGoals.length > 0 && (
                  <li className="text-[12px] text-muted">
                    {achievedGoals.length === 1
                      ? "1 meta lograda"
                      : `${achievedGoals.length} metas logradas`}
                  </li>
                )}
              </ul>
            )}
          </div>
          <Button href="/admin/tesoreria/metas">
            {goals.length === 0 ? "Cargar metas" : "Editar metas"}
          </Button>
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="mb-1 font-display text-[20px] font-semibold text-dark">
          Nuevo presupuesto
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Se crea con las 6 categorías por defecto en $0. Después definís las
          metas de cada una.
        </p>
        <form action={createBudgetAction}>
          <div className="grid gap-4 md:grid-cols-[1fr,160px]">
            <Field label="Período" name="period" required>
              <TextInput
                id="period"
                name="period"
                required
                placeholder="183 E.B. (2026–2027)"
              />
            </Field>
            <Field label="Año bahá'í" name="bahai_year" hint="opcional">
              <TextInput
                id="bahai_year"
                name="bahai_year"
                type="number"
                min="1"
                defaultValue={currentBahaiYear}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notas" name="notes" hint="opcional">
              <TextArea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Comentarios de la Asamblea sobre este presupuesto…"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit">Crear presupuesto</Button>
          </div>
        </form>
      </Card>

      {budgets.length === 0 ? (
        <Banner tone="info">
          Todavía no hay presupuestos. Creá el primero arriba.
        </Banner>
      ) : (
        <div className="flex flex-col gap-3">
          {budgets.map((b) => {
            const totals = totalsByBudget.get(b.id);
            const status = STATUS_META[b.status];
            return (
              <Link
                key={b.id}
                href={`/admin/tesoreria/presupuesto/${b.id}`}
                className="tap group flex items-center justify-between gap-4 rounded-2xl border border-black/[0.04] bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-elevated"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[18px] font-semibold text-dark">
                      {b.period}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    {totals && totals.planned > 0 ? (
                      <>
                        {fmtUYU(totals.planned)} presupuestado · año pasado{" "}
                        {fmtUYU(totals.spent)}
                      </>
                    ) : (
                      "Sin presupuesto definido todavía"
                    )}
                  </div>
                </div>
                <IconArrowRight
                  size={16}
                  className="shrink-0 text-muted transition group-hover:text-terra"
                />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
