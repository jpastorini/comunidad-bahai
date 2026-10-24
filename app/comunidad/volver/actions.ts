"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Le devuelve a la persona su comunidad si tenía una estructura puesta
 * (082) y la lleva adonde iba. Si no pertenece a ninguna comunidad —solo
 * a estructuras—, la app del creyente no tiene nada para ella: va al
 * panel.
 *
 * Si la 082 no corrió, la función no existe; eso no puede pasar con una
 * estructura puesta (sin la 082 no hay estructuras), así que también va
 * al panel en vez de entrar en un ciclo.
 */
export async function returnToCommunityAction(next: string): Promise<void> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("return_to_community");

  if (error || !data) {
    if (error) console.error("[volver] return_to_community:", error.message);
    redirect("/admin");
  }

  const safe =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/comunidad/volver")
      ? next
      : "/";
  // El caché del router guarda las pantallas ya visitadas: sin esto se
  // seguirían viendo las de la estructura (ver switchLocalityAction).
  revalidatePath("/", "layout");
  redirect(safe);
}
