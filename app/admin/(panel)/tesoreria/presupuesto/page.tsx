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
import { createSupabaseServer } from "@/lib/supabase/server";
import { createBudgetAction } from "./actions";
import { fmtUYU } from "./category-meta";

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

  const currentBahaiYear = 183; // 2026–2027

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Plan de Presupuesto"
        description="Definí metas de gasto por categoría para cada período. Las categorías en $0 no se cuentan en las metas del año."
        actions={
          <Button variant="secondary" href="/admin/tesoreria">
            ← Tesorería
          </Button>
        }
      />

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
                placeholder={String(currentBahaiYear)}
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
            const pct =
              totals && totals.planned > 0
                ? Math.round((totals.spent / totals.planned) * 100)
                : null;
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
                        {fmtUYU(totals.spent)} de {fmtUYU(totals.planned)}
                        {pct !== null && <> · {pct}% ejecutado</>}
                      </>
                    ) : (
                      "Sin metas definidas todavía"
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
