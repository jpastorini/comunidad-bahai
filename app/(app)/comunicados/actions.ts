"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Marca los comunicados como vistos para este miembro, guardando el
 * momento actual en `profiles.comunicados_seen_at`. Se invoca al abrir
 * /comunicados para apagar el punto de aviso de AEL.
 */
export async function markComunicadosSeenAction(userId: string) {
  const supabase = createSupabaseServer();
  await supabase
    .from("profiles")
    .update({ comunicados_seen_at: new Date().toISOString() })
    .eq("id", userId);
  revalidatePath("/");
  revalidatePath("/comunicados");
}
