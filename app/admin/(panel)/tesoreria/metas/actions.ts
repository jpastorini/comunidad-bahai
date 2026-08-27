"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";

/**
 * Metas de la Asamblea — guardado en bloque.
 *
 * Todas las filas del formulario llegan como arrays paralelos y se
 * recorren por índice: las que traen id se actualizan, las que no, se
 * insertan. Las que el tesorero quitó viajan aparte, en `deleted`,
 * porque un input que no se renderiza no llega al FormData.
 */

const UUID = /^[0-9a-f-]{36}$/i;
const CADENCES = ["mensual", "anual", "unica"];
const DIRECTIONS = ["gasto", "ingreso"];
const STATUSES = ["activa", "lograda", "archivada"];

/** "sub:<uuid>" → las tres columnas de vínculo con el libro. */
function parseLedgerRef(raw: string) {
  const [kind, id] = (raw ?? "").split(":");
  const valid = UUID.test(id ?? "");
  return {
    ledger_fund_id: valid && kind === "fund" ? id : null,
    ledger_category_id: valid && kind === "cat" ? id : null,
    ledger_subcategory_id: valid && kind === "sub" ? id : null,
  };
}

export async function saveGoalsAction(formData: FormData) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  const supabase = createSupabaseServer();

  const ids = formData.getAll("goal_id").map(String);
  const titles = formData.getAll("goal_title").map(String);
  const descriptions = formData.getAll("goal_description").map(String);
  const badges = formData.getAll("goal_badge").map(String);
  const targets = formData.getAll("goal_target").map(String);
  const currencies = formData.getAll("goal_currency").map(String);
  const cadences = formData.getAll("goal_cadence").map(String);
  const directions = formData.getAll("goal_direction").map(String);
  const statuses = formData.getAll("goal_status").map(String);
  const ledgers = formData.getAll("goal_ledger").map(String);
  const years = formData.getAll("goal_year").map(String);

  const deleted = ((formData.get("deleted") as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID.test(s));

  let errors = 0;

  for (const id of deleted) {
    const { error } = await supabase
      .from("treasury_goals")
      .delete()
      .eq("id", id)
      .eq("locality_id", session.locality.id);
    if (error) errors += 1;
  }

  for (let i = 0; i < titles.length; i += 1) {
    const title = (titles[i] ?? "").trim();
    // Una fila sin título es una fila que el tesorero agregó y no llenó.
    if (!title) continue;

    const rawTarget = (targets[i] ?? "").trim();
    const target = rawTarget === "" ? null : Number(rawTarget);
    const rawYear = (years[i] ?? "").trim();
    const year = rawYear === "" ? null : parseInt(rawYear, 10);

    const row = {
      title,
      description: (descriptions[i] ?? "").trim() || null,
      badge: (badges[i] ?? "").trim() || null,
      // Un monto en cero no es una meta: se guarda como "sin cifra".
      target_amount: target !== null && Number.isFinite(target) && target > 0 ? target : null,
      currency: currencies[i] === "USD" ? "USD" : "UYU",
      cadence: CADENCES.includes(cadences[i] ?? "") ? cadences[i] : "anual",
      direction: DIRECTIONS.includes(directions[i] ?? "") ? directions[i] : "gasto",
      status: STATUSES.includes(statuses[i] ?? "") ? statuses[i] : "activa",
      sort_order: i,
      bahai_year: year !== null && Number.isFinite(year) ? year : null,
      ...parseLedgerRef(ledgers[i] ?? ""),
      updated_at: new Date().toISOString(),
    };

    const id = (ids[i] ?? "").trim();
    if (UUID.test(id)) {
      const { error } = await supabase
        .from("treasury_goals")
        .update(row)
        .eq("id", id)
        .eq("locality_id", session.locality.id);
      if (error) errors += 1;
    } else {
      const { error } = await supabase.from("treasury_goals").insert({
        ...row,
        locality_id: session.locality.id,
        created_by: session.user.id,
      });
      if (error) errors += 1;
    }
  }

  setFlashToast(
    errors > 0
      ? {
          tone: "error",
          message: `${errors} ${errors === 1 ? "meta no se pudo" : "metas no se pudieron"} guardar.`,
        }
      : { tone: "success", message: "Metas guardadas." }
  );

  revalidatePath("/admin/tesoreria/metas");
  revalidatePath("/admin/tesoreria/progreso");
  revalidatePath("/tesoreria");
  redirect("/admin/tesoreria/metas");
}
