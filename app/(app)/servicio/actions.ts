"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { getLocalityAdminIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Ofrecerse o retirarse de una necesidad de servicio. Las dos avisan por
 * push a la Asamblea de la localidad: quien coordina necesita saber tanto
 * que hay alguien como que dejó de haberlo.
 */
export async function setVolunteerAction(
  needId: string,
  offer: boolean
): Promise<Result> {
  const session = await requireMember("/servicio");
  const supabase = createSupabaseServer();

  // La lectura pasa por la RLS de service_needs: si no es de la localidad
  // de quien pregunta, no existe.
  const { data: need } = await supabase
    .from("service_needs")
    .select("id, title, locality_id")
    .eq("id", needId)
    .maybeSingle();
  if (!need) return { ok: false, error: "Esa necesidad ya no está publicada." };

  if (offer) {
    const { error } = await supabase
      .from("service_volunteers")
      .insert({ need_id: needId, user_id: session.user.id });
    // 23505: ya estaba anotada (doble toque, otra pestaña). Es el estado pedido.
    if (error && error.code !== "23505") {
      console.error(`[servicio] offer: ${error.code} ${error.message}`);
      return { ok: false, error: "No se pudo registrar. Probá de nuevo en un rato." };
    }
    if (error) return { ok: true };
  } else {
    const { error } = await supabase
      .from("service_volunteers")
      .delete()
      .eq("need_id", needId)
      .eq("user_id", session.user.id);
    if (error) {
      console.error(`[servicio] withdraw: ${error.code} ${error.message}`);
      return { ok: false, error: "No se pudo quitar. Probá de nuevo en un rato." };
    }
  }

  const name = session.profile.full_name?.trim() || "Un creyente";
  const adminIds = (await getLocalityAdminIds(need.locality_id)).filter(
    (id) => id !== session.user.id
  );
  await sendPushToUsers(adminIds, {
    title: offer ? "Alguien se ofreció para servir" : "Se retiró un voluntario",
    body: offer
      ? `${name} se ofreció para: ${need.title}`
      : `${name} ya no puede para: ${need.title}`,
    url: `/admin/servicio/${needId}/voluntarios`,
    tag: `service-${needId}`,
  });

  revalidatePath("/servicio");
  revalidatePath("/admin/servicio");
  return { ok: true };
}
