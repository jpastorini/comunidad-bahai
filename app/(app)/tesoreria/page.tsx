import Link from "next/link";
import { GoldHeader } from "@/components/GoldHeader";
import { IconChat, IconChevronRight } from "@/components/Icons";
import { AEL_SEGMENTS, SegmentedNav } from "@/components/SegmentedNav";
import { BudgetReportShare } from "@/components/treasury/BudgetReportShare";
import { MonthlyReportShare } from "@/components/treasury/MonthlyReportShare";
import { ProgressBoard } from "@/components/treasury/ProgressBoard";
import { requireMember } from "@/lib/auth";
import { getTreasury } from "@/lib/data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/treasury-ledger";
import { getTreasuryProgress } from "@/lib/treasury-progress";
import type { TreasuryCommitment } from "@/lib/types";
import type { BudgetViewItem } from "./budget-view";
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

  // Progreso del ejercicio. Los totales vienen de la función security
  // definer `treasury_progress`: un creyente no lee el libro, pero sí los
  // agregados, que no llevan ningún nombre.
  const progress = await getTreasuryProgress(supabase, {
    localityId: session.locality.id,
    asOf: todayISO(),
  });

  // Presupuesto vigente: se sigue leyendo solo para el compartible de
  // imagen, que todavía no migró al libro.
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
        {/* Progreso del ejercicio: presupuesto y metas, calculado desde el
            libro. Reemplaza al anillo que leía un porcentaje escrito a
            mano y que ya contradecía a los movimientos. */}
        {progress ? (
          <div className="mb-3.5">
            <ProgressBoard data={progress} compact />
          </div>
        ) : (
          <div className="mb-3.5 rounded-[20px] bg-card p-5 text-center text-[12.5px] text-muted shadow-card-elevated">
            La Tesorería todavía no publicó el progreso de este ejercicio.
          </div>
        )}

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

          {/* Un giro a la cuenta no le dice al tesorero de quién es ni a qué
              fondo va. Este es el atajo para avisarle, acá donde la persona
              se acuerda. */}
          <Link
            href="/chat/tesoreria"
            className="tap mt-2.5 flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-card-soft"
          >
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-terra/10 text-terra">
              <IconChat size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-dark">
                ¿Hiciste un giro a la cuenta?
              </div>
              <div className="mt-0.5 font-body text-[10.5px] text-muted">
                Avisale al tesorero en privado: fecha, monto y destino.
              </div>
            </div>
            <IconChevronRight size={14} className="shrink-0 text-muted" />
          </Link>
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

        {/* Compartir reportes (imagen para WhatsApp) */}
        <section className="mb-3.5">
          <h2 className="mb-2.5 text-[14px] font-semibold text-dark">
            Compartir
          </h2>
          <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-card-soft">
            <p className="text-[12px] text-muted">
              Generá una imagen del fondo para enviar al grupo.
            </p>
            <MonthlyReportShare
              preview={false}
              buttonLabel="Compartir reporte mensual"
              localityName={session.locality.name}
              period={t.period}
              goalAmount={t.goal_amount}
              currentAmount={t.current_amount}
              contributions={t.contributions}
              methods={t.methods}
            />
            {activeBudget && budgetItems.length > 0 && (
              <BudgetReportShare
                preview={false}
                buttonLabel="Compartir presupuesto"
                localityName={session.locality.name}
                period={(activeBudget as { period: string }).period}
                items={budgetItems}
              />
            )}
          </div>
        </section>

        {/* Compromiso mensual del miembro logueado */}
        <CommitmentSection
          defaultName={session.profile.full_name ?? ""}
          commitment={(commitment as TreasuryCommitment | null) ?? null}
        />
      </main>
    </>
  );
}
