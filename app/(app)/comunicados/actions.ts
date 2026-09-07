"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getOptionalMember } from "@/lib/auth";
import { civilDateISO } from "@/lib/citas";
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

// ─── Lectura por comunicado (migración 048) ────────────────────────
//
// Ninguna de estas dos revalida rutas: se disparan mientras la persona
// scrollea y tirar el caché de la pantalla en cada marca haría que la
// lista se recargue debajo de su dedo. El estado visible lo lleva la
// tarjeta en el cliente; el servidor lo va a leer en la próxima visita.

/**
 * "Visto": la tarjeta estuvo en pantalla. Inserta si no había fila y no
 * toca la que ya existe (`ignoreDuplicates`), así el primer `seen_at`
 * queda como registro. La RLS solo deja marcar comunicados que la
 * persona puede leer.
 */
export async function markMessageSeenAction(messageId: string): Promise<boolean> {
  const me = await getOptionalMember();
  if (!me) return false;
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("message_reads")
    .upsert(
      { message_id: messageId, profile_id: me.user.id },
      { onConflict: "message_id,profile_id", ignoreDuplicates: true }
    );
  if (error) {
    console.error("[message-reads] seen:", error.message);
    return false;
  }
  return true;
}

/**
 * "Enterado/a": confirmación explícita. Si no había fila la crea (una
 * confirmación implica que lo vio); si la había, solo llena
 * `confirmed_at`, porque `seen_at` no va en el payload y el upsert no
 * lo pisa.
 */
export async function confirmMessageReadAction(
  messageId: string
): Promise<{ ok: true; confirmedAt: string } | { ok: false }> {
  const me = await getOptionalMember();
  if (!me) return { ok: false };
  const confirmedAt = new Date().toISOString();
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("message_reads")
    .upsert(
      { message_id: messageId, profile_id: me.user.id, confirmed_at: confirmedAt },
      { onConflict: "message_id,profile_id" }
    );
  if (error) {
    console.error("[message-reads] confirm:", error.message);
    return { ok: false };
  }
  return { ok: true, confirmedAt };
}

// ─── Última vez en la app ──────────────────────────────────────────

const LAST_SEEN_COOKIE = "cb_last_seen_day";

/**
 * Anota `profiles.last_seen_at` a lo sumo una vez por día civil. La
 * cookie es el freno: mientras diga "hoy", la acción no escribe nada.
 * Es lo que separa, en la lista de quienes no vieron un comunicado, a
 * quien no entra nunca de quien entró ayer y no llegó.
 */
export async function touchLastSeenAction(): Promise<void> {
  const today = civilDateISO();
  const jar = cookies();
  if (jar.get(LAST_SEEN_COOKIE)?.value === today) return;
  const me = await getOptionalMember();
  if (!me) return;
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", me.user.id);
  if (error) {
    // Antes de la 048 la columna no existe; no vale la pena insistir
    // hasta mañana.
    console.error("[last-seen]", error.message);
  }
  jar.set({
    name: LAST_SEEN_COOKIE,
    value: today,
    path: "/",
    maxAge: 60 * 60 * 36,
    sameSite: "lax",
  });
}
