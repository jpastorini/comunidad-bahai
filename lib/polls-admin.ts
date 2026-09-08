/**
 * Guardado de la encuesta de un comunicado (051), del lado del panel.
 *
 * Vive aparte de los server actions porque lo usan DOS formularios: el
 * de Comunicados (tarjeta "Pregunta para votar") y el de Encuestas, que
 * es la misma cosa pensada desde la pregunta. Un módulo "use server"
 * solo puede exportar actions, así que la lógica compartida va acá.
 */

import { isSchemaMissing, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "./polls-shared";
import { createSupabaseServer } from "./supabase/server";

/** 'YYYY-MM-DD' → fin de ese día civil en Montevideo (UTC-3, sin horario de verano). */
function endOfMontevideoDay(date: string): string {
  return new Date(`${date}T23:59:59-03:00`).toISOString();
}

/**
 * Guarda la pregunta del comunicado según lo que vino en el formulario:
 *   · sin `poll_enabled` → si había encuesta SIN votos, se borra;
 *   · con votos ya emitidos → solo se toca la fecha de cierre (la
 *     pregunta y las opciones vienen de solo lectura y NO viajan; el
 *     action no las espera, ver la regla de los `disabled` en CLAUDE.md);
 *   · si no → se crea o se reescribe entera (sin votos, las opciones se
 *     reemplazan, no hay nada que apunte a ellas).
 * Devuelve la pregunta (para el push) y un aviso si algo no se pudo.
 */
export async function savePoll(
  formData: FormData,
  messageId: string
): Promise<{ question: string | null; warning: string | null }> {
  const supabase = createSupabaseServer();
  const enabled = formData.get("poll_enabled") === "on";

  const { data: existing, error: readErr } = await supabase
    .from("message_polls")
    .select("id, question, poll_participants(count)")
    .eq("message_id", messageId)
    .maybeSingle();
  if (readErr) {
    if (isSchemaMissing(readErr.code)) {
      return {
        question: null,
        warning: enabled
          ? "El comunicado se guardó, pero la encuesta no: falta aplicar la migración 051."
          : null,
      };
    }
    console.error("[polls] read existing:", readErr.message);
    return { question: null, warning: enabled ? "El comunicado se guardó, pero la encuesta no." : null };
  }
  const current = existing as
    | { id: string; question: string; poll_participants: Array<{ count: number }> | null }
    | null;
  const participants = current?.poll_participants?.[0]?.count ?? 0;

  if (!enabled) {
    if (current && participants === 0) {
      const { error } = await supabase.from("message_polls").delete().eq("id", current.id);
      if (error) return { question: null, warning: `No se pudo quitar la encuesta: ${error.message}` };
    }
    return { question: null, warning: null };
  }

  const closesOn = ((formData.get("poll_closes_on") as string) || "").trim();
  const closes_at = /^\d{4}-\d{2}-\d{2}$/.test(closesOn) ? endOfMontevideoDay(closesOn) : null;

  if (current && participants > 0) {
    const { error } = await supabase
      .from("message_polls")
      .update({ closes_at })
      .eq("id", current.id);
    return {
      question: current.question,
      warning: error ? `No se pudo cambiar el cierre de la encuesta: ${error.message}` : null,
    };
  }

  const question = ((formData.get("poll_question") as string) || "").trim().slice(0, 200);
  const labels = formData
    .getAll("poll_options[]")
    .map((v) => String(v).trim().slice(0, 100))
    .filter((v) => v.length > 0);
  if (!question || labels.length < POLL_MIN_OPTIONS) {
    return {
      question: null,
      warning: "El comunicado se guardó, pero la encuesta necesita una pregunta y al menos dos opciones.",
    };
  }
  const options = labels.slice(0, POLL_MAX_OPTIONS);
  const fields = {
    question,
    allow_multiple: formData.get("poll_allow_multiple") === "on",
    anonymous: formData.get("poll_anonymous") === "on",
    closes_at,
  };

  let pollId = current?.id ?? null;
  if (pollId) {
    const [{ error: upErr }, { error: delErr }] = await Promise.all([
      supabase.from("message_polls").update(fields).eq("id", pollId),
      supabase.from("poll_options").delete().eq("poll_id", pollId),
    ]);
    const err = upErr ?? delErr;
    if (err) return { question, warning: `No se pudo actualizar la encuesta: ${err.message}` };
  } else {
    const { data, error } = await supabase
      .from("message_polls")
      .insert({ message_id: messageId, ...fields })
      .select("id")
      .single();
    if (error || !data) {
      return {
        question: null,
        warning: `El comunicado se guardó, pero la encuesta no: ${error?.message ?? "error desconocido"}`,
      };
    }
    pollId = (data as { id: string }).id;
  }

  const { error: optErr } = await supabase
    .from("poll_options")
    .insert(options.map((label, position) => ({ poll_id: pollId, position, label })));
  if (optErr) return { question, warning: `No se pudieron guardar las opciones: ${optErr.message}` };
  return { question, warning: null };
}

