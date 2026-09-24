"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFeastAccess, requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

type RsvpResult = { ok: true } | { ok: false; error: string };

/**
 * "Voy" a la Fiesta (065). `going=false` lo deshace. Con varios lugares,
 * `locationId` dice adónde; volver a confirmar con otro lugar lo cambia.
 * Las reglas (creyente, Fiesta publicada y no iniciada, lugar de esa
 * Fiesta) las hace la RLS; acá se chequea antes solo para responder en
 * palabras.
 */
export async function setFeastRsvpAction(
  feastId: string,
  going: boolean,
  locationId: string | null
): Promise<RsvpResult> {
  const session = await requireFeastAccess(`/fiestas/${feastId}`);
  const supabase = createSupabaseServer();

  const { data: feast } = await supabase
    .from("feasts")
    .select("id, status")
    .eq("id", feastId)
    .maybeSingle();
  if (!feast) return { ok: false, error: "No encontramos esa Fiesta." };
  if (feast.status !== "published") {
    return {
      ok: false,
      error:
        feast.status === "in_progress"
          ? "La Fiesta ya empezó: la lista de quienes van quedó cerrada."
          : "Esta Fiesta todavía no está publicada.",
    };
  }

  const { error } = going
    ? await supabase.from("feast_rsvps").upsert(
        { feast_id: feastId, user_id: session.user.id, location_id: locationId },
        { onConflict: "feast_id,user_id" }
      )
    : await supabase
        .from("feast_rsvps")
        .delete()
        .eq("feast_id", feastId)
        .eq("user_id", session.user.id);

  if (error) {
    console.error(`[fiestas] rsvp: ${error.code} ${error.message}`);
    if (["42P01", "PGRST205"].includes(error.code ?? "")) {
      return { ok: false, error: "Falta una actualización de la base (065)." };
    }
    return { ok: false, error: "No se pudo guardar. Probá de nuevo en un rato." };
  }

  // Lo tocó la persona con un botón (no mientras scrollea): se puede
  // tirar el caché de las dos pantallas.
  revalidatePath(`/fiestas/${feastId}`);
  revalidatePath(`/admin/fiestas/${feastId}`);
  return { ok: true };
}

export async function submitSuggestionAction(formData: FormData) {
  const feastId = formData.get("feast_id") as string;
  const detail = (formData.get("detail") as string)?.trim();

  if (!feastId) redirect("/fiestas");
  if (!detail) redirect(`/fiestas/${feastId}?sent=0`);

  const session = await requireMember(`/fiestas/${feastId}`);
  const supabase = createSupabaseServer();
  await supabase.from("feast_suggestions").insert({
    feast_id: feastId,
    user_id: session.user.id,
    detail,
  });

  revalidatePath(`/fiestas/${feastId}`);
  revalidatePath(`/admin/fiestas/${feastId}`);
  redirect(`/fiestas/${feastId}?sent=1`);
}
