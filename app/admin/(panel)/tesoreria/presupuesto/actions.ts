"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Categorías por defecto para un presupuesto nuevo.
 * Cada Asamblea puede agregar categorías personalizadas.
 */
export const DEFAULT_BUDGET_CATEGORIES = [
  { category: "Enseñanza", icon: "ensenanza", position: 0 },
  { category: "Mantenimiento", icon: "mantenimiento", position: 1 },
  { category: "Tareas Administrativas", icon: "administrativas", position: 2 },
  { category: "Ayuda Social", icon: "ayuda_social", position: 3 },
  { category: "Aporte al Fondo Nacional", icon: "fondo_nacional", position: 4 },
  { category: "Reserva Fondo Local", icon: "fondo_local", position: 5 },
] as const;

/**
 * Crea un presupuesto nuevo con las 6 categorías por defecto,
 * todas en $0 (el tesorero decide cuáles activar).
 */
export async function createBudgetAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const period = (formData.get("period") as string)?.trim();
  if (!period) {
    setFlashToast({ tone: "error", message: "El período es obligatorio." });
    redirect("/admin/tesoreria/presupuesto");
  }

  const bahaiYear = parseInt((formData.get("bahai_year") as string) || "0", 10);
  const notes = (formData.get("notes") as string)?.trim() || null;

  const supabase = createSupabaseServer();

  // Crear el presupuesto
  const { data: budget, error: budgetErr } = await supabase
    .from("treasury_budgets")
    .insert({
      locality_id: session.profile.locality_id,
      period,
      bahai_year: bahaiYear || null,
      notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (budgetErr || !budget) {
    setFlashToast({
      tone: "error",
      message: budgetErr?.message.includes("unique")
        ? "Ya existe un presupuesto para ese período."
        : `Error: ${budgetErr?.message ?? "desconocido"}`,
    });
    redirect("/admin/tesoreria/presupuesto");
  }

  // Insertar categorías por defecto (todas en $0)
  const items = DEFAULT_BUDGET_CATEGORIES.map((cat) => ({
    budget_id: budget.id,
    category: cat.category,
    icon: cat.icon,
    planned_amount: 0,
    spent_amount: 0,
    position: cat.position,
  }));

  const { error: itemsErr } = await supabase
    .from("treasury_budget_items")
    .insert(items);

  setFlashToast(
    itemsErr
      ? { tone: "error", message: `Error creando categorías: ${itemsErr.message}` }
      : { tone: "success", message: "Presupuesto creado. Definí las metas por categoría." }
  );

  revalidatePath("/admin/tesoreria");
  redirect(`/admin/tesoreria/presupuesto/${budget.id}`);
}

/**
 * Guarda los montos de todas las líneas de un presupuesto existente.
 * Recibe arrays paralelos: item_id[], planned_amount[], spent_amount[].
 */
export async function saveBudgetItemsAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const budgetId = formData.get("budget_id") as string;
  const status = formData.get("status") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const ids = formData.getAll("item_id[]") as string[];
  const plannedAmounts = formData.getAll("planned_amount[]") as string[];
  const spentAmounts = formData.getAll("spent_amount[]") as string[];

  const supabase = createSupabaseServer();

  // Actualizar metadatos del presupuesto
  const { error: budgetErr } = await supabase
    .from("treasury_budgets")
    .update({
      status: ["draft", "active", "closed"].includes(status) ? status : "draft",
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", budgetId);

  if (budgetErr) {
    setFlashToast({ tone: "error", message: `Error: ${budgetErr.message}` });
    redirect(`/admin/tesoreria/presupuesto/${budgetId}`);
  }

  // Actualizar cada línea
  const updates = ids.map((id, i) => ({
    id,
    planned_amount: parseFloat(plannedAmounts[i] || "0"),
    spent_amount: parseFloat(spentAmounts[i] || "0"),
  }));

  let hasError = false;
  for (const upd of updates) {
    const { error } = await supabase
      .from("treasury_budget_items")
      .update({
        planned_amount: upd.planned_amount,
        spent_amount: upd.spent_amount,
      })
      .eq("id", upd.id);
    if (error) hasError = true;
  }

  setFlashToast(
    hasError
      ? { tone: "error", message: "Algunos ítems no se pudieron guardar." }
      : { tone: "success", message: "Presupuesto actualizado." }
  );

  revalidatePath("/admin/tesoreria");
  revalidatePath(`/admin/tesoreria/presupuesto/${budgetId}`);
  redirect(`/admin/tesoreria/presupuesto/${budgetId}`);
}

/**
 * Agrega una categoría personalizada a un presupuesto existente.
 */
export async function addBudgetCategoryAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);

  const budgetId = formData.get("budget_id") as string;
  const category = (formData.get("category") as string)?.trim();

  if (!category) {
    setFlashToast({ tone: "error", message: "El nombre de la categoría es obligatorio." });
    redirect(`/admin/tesoreria/presupuesto/${budgetId}`);
  }

  const supabase = createSupabaseServer();

  // Determinar la próxima posición
  const { data: existing } = await supabase
    .from("treasury_budget_items")
    .select("position")
    .eq("budget_id", budgetId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = (existing?.position ?? -1) + 1;

  const { error } = await supabase.from("treasury_budget_items").insert({
    budget_id: budgetId,
    category,
    icon: "default",
    planned_amount: 0,
    spent_amount: 0,
    position: nextPos,
  });

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : { tone: "success", message: `Categoría "${category}" agregada.` }
  );

  revalidatePath(`/admin/tesoreria/presupuesto/${budgetId}`);
  redirect(`/admin/tesoreria/presupuesto/${budgetId}`);
}
