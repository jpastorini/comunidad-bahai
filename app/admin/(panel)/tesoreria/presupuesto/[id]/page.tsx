import { notFound } from "next/navigation";
import { Button, Card, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BudgetReportShare } from "@/components/treasury/BudgetReportShare";
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
  ledger_category_id: string | null;
  ledger_subcategory_id: string | null;
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

  // El catálogo del libro alimenta el desplegable "Se ejecuta con": es
  // lo que le permite al informe calcular el ejecutado de cada línea.
  const [itemsRes, categoriesRes, subcategoriesRes] = await Promise.all([
    supabase
      .from("treasury_budget_items")
      .select(
        "id, category, icon, planned_amount, spent_amount, position, ledger_category_id, ledger_subcategory_id"
      )
      .eq("budget_id", budget.id)
      .order("position", { ascending: true }),
    supabase
      .from("treasury_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("treasury_subcategories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const items: EditorItem[] = ((itemsRes.data ?? []) as ItemRow[]).map((it) => ({
    id: it.id,
    category: it.category,
    icon: it.icon,
    planned: Number(it.planned_amount),
    spent: Number(it.spent_amount),
    position: it.position,
    // La subcategoría manda si están las dos: es el vínculo más específico.
    ledgerRef: it.ledger_subcategory_id
      ? `sub:${it.ledger_subcategory_id}`
      : it.ledger_category_id
        ? `cat:${it.ledger_category_id}`
        : "",
  }));

  const ledgerOptions = {
    categories: (categoriesRes.data ?? []) as { id: string; name: string }[],
    subcategories: (subcategoriesRes.data ?? []) as { id: string; name: string }[],
  };

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
        ledgerOptions={ledgerOptions}
        saveAction={saveBudgetItemsAction}
        addCategoryAction={addBudgetCategoryAction}
      />

      <Card className="mt-5">
        <h2 className="mb-1 font-display text-[16px] font-semibold text-dark">
          Compartir reporte
        </h2>
        <p className="mb-4 text-[12px] text-muted">
          Genera una imagen del presupuesto para enviar al grupo. Refleja lo
          último guardado.
        </p>
        <BudgetReportShare
          localityName={session.locality.name}
          period={budget.period}
          items={items}
        />
      </Card>
    </>
  );
}
