import { notFound } from "next/navigation";
import { Button, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { addBudgetCategoryAction, saveBudgetItemsAction } from "../actions";
import { BudgetEditor, type EditorItem } from "../budget-editor";

export const revalidate = 60;

type BudgetRow = {
  id: string;
  locality_id: string | null;
  period: string;
  bahai_year: number | null;
  status: "draft" | "active" | "closed";
  notes: string | null;
};

type ItemRow = {
  id: string;
  category: string;
  icon: string;
  planned_amount: number;
  spent_amount: number;
  position: number;
};

export default async function PresupuestoEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const supabase = createSupabaseServer();

  const { data: budgetRaw } = await supabase
    .from("treasury_budgets")
    .select("id, locality_id, period, bahai_year, status, notes")
    .eq("id", params.id)
    .maybeSingle();

  const budget = budgetRaw as BudgetRow | null;

  // La RLS es select-all; validamos pertenencia a la localidad del admin.
  if (!budget || budget.locality_id !== session.locality.id) {
    notFound();
  }

  const { data: itemsRaw } = await supabase
    .from("treasury_budget_items")
    .select("id, category, icon, planned_amount, spent_amount, position")
    .eq("budget_id", budget.id)
    .order("position", { ascending: true });

  const items: EditorItem[] = ((itemsRaw ?? []) as ItemRow[]).map((it) => ({
    id: it.id,
    category: it.category,
    icon: it.icon,
    planned: Number(it.planned_amount),
    spent: Number(it.spent_amount),
    position: it.position,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Tesorería · Presupuesto"
        title={budget.period}
        description="Tomá como referencia lo gastado el año pasado y definí el presupuesto de este año por categoría. Las categorías en $0 se omiten del total."
        actions={
          <Button variant="secondary" href="/admin/tesoreria/presupuesto">
            ← Presupuestos
          </Button>
        }
      />

      <BudgetEditor
        budgetId={budget.id}
        period={budget.period}
        status={budget.status}
        notes={budget.notes}
        items={items}
        saveAction={saveBudgetItemsAction}
        addCategoryAction={addBudgetCategoryAction}
      />
    </>
  );
}
