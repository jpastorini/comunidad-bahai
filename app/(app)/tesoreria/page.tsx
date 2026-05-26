import { GoldHeader } from "@/components/GoldHeader";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { requireMember } from "@/lib/auth";
import { getTreasury } from "@/lib/data";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { TreasuryCommitment } from "@/lib/types";
import { BudgetView, type BudgetViewItem } from "./budget-view";
import { CommitmentSection } from "./commitment-section";

// La Tesorería contiene información reservada — solo miembros autenticados.
export const revalidate = 60;

export default async function TesoreriaPage() {
  const session = await requireMember("/tesoreria");
  const t = await getTreasury();

  const supabase = createSupabaseServer();
  const { data: commitment } = await supabase
    .from("treasury_commitments")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // Presupuesto vigente de la localidad (solo lectura para miembros).
  const { data: activeBudget } = await supabase
    .from("treasury_budgets")
    .select("id, period")
    .eq("locality_id", session.locality.id)
    .eq("status", "active")
    .order("bahai_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let budgetItems: BudgetViewItem[] = [];
  if (activeBudget) {
    const { data: itemsRaw } = await supabase
      .from("treasury_budget_items")
      .select("id, category, icon, planned_amount, spent_amount")
      .eq("budget_id", (activeBudget as { id: string }).id)
      .gt("planned_amount", 0)
      .order("position", { ascending: true });
    budgetItems = (
      (itemsRaw ?? []) as Array<{
        id: string;
        category: string;
        icon: string;
        planned_amount: number;
        spent_amount: number;
      }>
    ).map((it) => ({
      id: it.id,
      category: it.category,
      icon: it.icon,
      planned: Number(it.planned_amount),
      spent: Number(it.spent_amount),
    }));
  }

  const pct = Math.max(0, Math.min(1, t.current_amount / t.goal_amount));
  const r = 56;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);

  const fmt = (n: number) =>
    n.toLocaleString("es-UY", {
      style: "currency",
      currency: "UYU",
      maximumFractionDigits: 0,
    });

  return (
    <>
      <GoldHeader title="Asamblea Local" subtitle={session.locality.name} backHref="/" />
      <SegmentedNav items={AEL_SEGMENTS} />
      <main className="scroll-area flex-1 px-4 pt-4">
        {/* Progress ring */}
        <div className="mb-3.5 flex flex-col items-center rounded-[20px] bg-card p-5 shadow-card-elevated">
          <div className="relative mb-3.5 h-32 w-32">
            <svg
              width="128"
              height="128"
              viewBox="0 0 128 128"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="#7E44B818"
                strokeWidth="9"
              />
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="#7E44B8"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-[30px] font-bold text-dark">
                {Math.round(pct * 100)}%
              </div>
              <div className="font-body text-[10px] text-muted">de la meta</div>
            </div>
          </div>
          <div className="text-[15px] font-semibold text-dark">
            {fmt(t.current_amount)} de {fmt(t.goal_amount)}
          </div>
          <div className="mt-0.5 font-body text-[11px] text-muted">
            Meta anual del Fondo
          </div>
        </div>

        {/* Contribution methods */}
        <div className="mb-3.5">
          <h2 className="mb-2.5 text-[14px] font-semibold text-dark">
            Cómo aportar
          </h2>
          <div className="flex gap-2.5">
            {t.methods.map((m) => (
              <div
                key={m.type}
                className="flex-1 rounded-2xl bg-card p-3.5 shadow-card-soft"
              >
                <div
                  className="mb-2 flex h-[34px] w-[34px] items-center justify-center rounded-[11px] font-display text-base font-bold text-terra"
                  style={{ background: "#2A3F8F10" }}
                >
                  {m.letter}
                </div>
                <div className="text-[12.5px] font-semibold text-dark">
                  {m.type}
                </div>
                <div className="mt-0.5 font-body text-[10.5px] text-muted">
                  {m.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly report */}
        <div className="mb-3.5 rounded-2xl bg-card p-4 shadow-card-soft">
          <h3 className="mb-2.5 text-[13px] font-semibold text-dark">
            Informe mensual
          </h3>
          {t.contributions.map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-2 ${
                i < arr.length - 1
                  ? "border-b border-[rgba(42,63,143,0.06)]"
                  : ""
              }`}
            >
              <span className="font-body text-[12px] text-muted">{row.label}</span>
              <span className="text-[12px] font-semibold text-dark">
                {fmt(row.amount)}
              </span>
            </div>
          ))}
        </div>

        {/* Presupuesto vigente (solo lectura) */}
        {activeBudget && (
          <BudgetView
            period={(activeBudget as { period: string }).period}
            items={budgetItems}
          />
        )}

        {/* Compromiso mensual del miembro logueado */}
        <CommitmentSection
          defaultName={session.profile.full_name ?? ""}
          commitment={(commitment as TreasuryCommitment | null) ?? null}
        />
      </main>
    </>
  );
}
