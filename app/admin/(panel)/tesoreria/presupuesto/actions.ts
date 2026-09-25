"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { bahaiYearFromPeriod } from "@/lib/budget-lookup";
import { setFlashToast } from "@/lib/toast";

/**
 * Categorías por defecto para un presupuesto nuevo.
 * Cada Asamblea puede agregar categorías personalizadas.
 *
 * NOTA: no se exporta — un archivo "use server" solo puede exportar
 * funciones async. Se usa únicamente dentro de createBudgetAction.
 */
const DEFAULT_BUDGET_CATEGORIES = [
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

  // El año es lo que ata el presupuesto al ejercicio (progreso e
  // informe lo buscan por acá). Si el campo quedó vacío se toma del
  // período escrito ("183 E.B." → 183) antes que dejarlo en NULL.
  const bahaiYear =
    parseInt((formData.get("bahai_year") as string) || "0", 10) ||
    bahaiYearFromPeriod(period);
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
  // Vacío = no tocar la columna (nunca pisar un año cargado con NULL).
  const bahaiYear = parseInt((formData.get("bahai_year") as string) || "0", 10);

  const ids = formData.getAll("item_id[]") as string[];
  const plannedAmounts = formData.getAll("planned_amount[]") as string[];
  const spentAmounts = formData.getAll("spent_amount[]") as string[];
  // "Se ejecuta con" (067): varios rubros por línea, cada uno como
  // "<item_id>|cat:<uuid>" o "<item_id>|sub:<uuid>". Una línea sin
  // ninguno queda sin vincular.
  const UUID = /^[0-9a-f-]{36}$/i;
  const linksByItem = new Map<string, { cats: string[]; subs: string[] }>();
  for (const raw of formData.getAll("ledger_link[]") as string[]) {
    const [itemId, ref = ""] = raw.split("|");
    const [kind, refId] = ref.split(":");
    if (!UUID.test(refId ?? "") || (kind !== "cat" && kind !== "sub")) continue;
    const cur = linksByItem.get(itemId) ?? { cats: [], subs: [] };
    const list = kind === "cat" ? cur.cats : cur.subs;
    if (!list.includes(refId)) list.push(refId);
    linksByItem.set(itemId, cur);
  }

  const supabase = createSupabaseServer();

  // Actualizar metadatos del presupuesto
  const { error: budgetErr } = await supabase
    .from("treasury_budgets")
    .update({
      status: ["draft", "active", "closed"].includes(status) ? status : "draft",
      notes,
      ...(bahaiYear > 0 ? { bahai_year: bahaiYear } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", budgetId);

  if (budgetErr) {
    setFlashToast({ tone: "error", message: `Error: ${budgetErr.message}` });
    redirect(`/admin/tesoreria/presupuesto/${budgetId}`);
  }

  // Actualizar cada línea
  const updates = ids.map((id, i) => {
    const links = linksByItem.get(id) ?? { cats: [], subs: [] };
    return {
      id,
      planned_amount: parseFloat(plannedAmounts[i] || "0"),
      spent_amount: parseFloat(spentAmounts[i] || "0"),
      ledger_category_ids: links.cats,
      ledger_subcategory_ids: links.subs,
    };
  });

  let hasError = false;
  let schemaMissing = false;
  for (const upd of updates) {
    const { error } = await supabase
      .from("treasury_budget_items")
      .update({
        planned_amount: upd.planned_amount,
        spent_amount: upd.spent_amount,
        ledger_category_ids: upd.ledger_category_ids,
        ledger_subcategory_ids: upd.ledger_subcategory_ids,
        // Las columnas de un solo rubro (042) dejan de usarse: budgetLinks()
        // las suma a las listas, así que si quedaran puestas no se podría
        // quitar ese rubro desde el editor.
        ledger_category_id: null,
        ledger_subcategory_id: null,
      })
      .eq("id", upd.id);
    if (error) {
      hasError = true;
      if (error.code === "PGRST204" || error.code === "42703") schemaMissing = true;
    }
  }

  setFlashToast(
    schemaMissing
      ? {
          tone: "error",
          message:
            "No se guardaron las líneas: falta aplicar la migración 067 (varios rubros por línea) en Supabase.",
        }
      : hasError
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
