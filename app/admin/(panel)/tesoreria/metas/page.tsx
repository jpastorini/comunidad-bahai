import { Button, PageHeader } from "@/components/admin/ui";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/treasury-ledger";
import { getGoals } from "@/lib/treasury-progress";
import { treasuryYearForDate } from "@/lib/treasury-year";
import { saveGoalsAction } from "./actions";
import { GoalsEditor, type GoalRowData } from "./goals-editor";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const bahaiYear = treasuryYearForDate(todayISO());

  const [goals, funds, categories, subcategories] = await Promise.all([
    getGoals(supabase, session.locality.id),
    supabase.from("treasury_funds").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("treasury_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("treasury_subcategories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const rows: GoalRowData[] = goals.map((g) => ({
    uid: g.id,
    id: g.id,
    title: g.title,
    description: g.description ?? "",
    badge: g.badge ?? "",
    target: g.target_amount === null ? "" : String(g.target_amount),
    currency: g.currency,
    cadence: g.cadence,
    direction: g.direction,
    status: g.status,
    // Manda el vínculo más específico, igual que en el presupuesto.
    ledgerRef: g.ledger_subcategory_id
      ? `sub:${g.ledger_subcategory_id}`
      : g.ledger_category_id
        ? `cat:${g.ledger_category_id}`
        : g.ledger_fund_id
          ? `fund:${g.ledger_fund_id}`
          : "",
    yearScope: g.bahai_year === null ? "" : String(g.bahai_year),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Tesorería"
        title="Metas de la Asamblea"
        description="Lo que la Asamblea se propuso, con el rubro del libro que lo mide. De acá salen las barras de progreso del tablero."
        actions={
          <>
            <Button href="/admin/tesoreria/progreso">Tablero de progreso</Button>
            <Button variant="secondary" href="/admin/tesoreria">
              Volver a Tesorería
            </Button>
          </>
        }
      />

      <GoalsEditor
        goals={rows}
        options={{
          funds: (funds.data ?? []) as { id: string; name: string }[],
          categories: (categories.data ?? []) as { id: string; name: string }[],
          subcategories: (subcategories.data ?? []) as { id: string; name: string }[],
        }}
        bahaiYear={bahaiYear}
        saveAction={saveGoalsAction}
      />
    </>
  );
}
