"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  FIRST_HOUR,
  LAST_HOUR,
  type AvailabilityLevel,
} from "@/lib/availability";
import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: boolean; error: string | null };

/**
 * Fija el nivel de UNA celda recurrente (día × hora) del usuario actual.
 * level = null → "No puedo" (borra la fila). 1 o 2 → upsert.
 *
 * No usamos upsert sobre el índice parcial (event_date IS NULL) porque la
 * inferencia de ON CONFLICT con predicado es frágil; un delete + insert es
 * simple y suficiente para una sola celda.
 */
export async function setAvailabilityCellAction(
  weekday: number,
  hour: number,
  level: AvailabilityLevel | null
): Promise<Result> {
  const session = await requireAdmin();

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, error: "Día inválido." };
  }
  if (!Number.isInteger(hour) || hour < FIRST_HOUR || hour > LAST_HOUR) {
    return { ok: false, error: "Hora inválida." };
  }
  if (level !== null && level !== 1 && level !== 2) {
    return { ok: false, error: "Nivel inválido." };
  }

  const supabase = createSupabaseServer();

  const { error: delError } = await supabase
    .from("availability_slots")
    .delete()
    .eq("user_id", session.user.id)
    .eq("weekday", weekday)
    .eq("hour", hour)
    .is("event_date", null);
  if (delError) return { ok: false, error: delError.message };

  if (level !== null) {
    const { error: insError } = await supabase
      .from("availability_slots")
      .insert({
        user_id: session.user.id,
        locality_id: session.locality.id,
        weekday,
        hour,
        level,
      });
    if (insError) return { ok: false, error: insError.message };
  }

  revalidatePath("/admin/disponibilidad");
  return { ok: true, error: null };
}
