"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, isSchemaMissing } from "@/lib/polls";
import { getLocalityMemberIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import type { MessageAudience } from "@/lib/types";

const BUCKET = "comunicados";

async function uploadAttachment(
  file: File | null,
  folder: "pdf" | "image"
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = createSupabaseServer();
  const ext = file.name.split(".").pop() || (folder === "pdf" ? "pdf" : "bin");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error(`Upload ${folder} error:`, error);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function upsertComunicadoAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = formData.get("id") as string | null;
  const title = formData.get("title") as string;
  const subject = (formData.get("subject") as string) || null;
  const fullText = (formData.get("full_text") as string) || null;
  const excerptInput = (formData.get("excerpt") as string)?.trim();
  const excerpt =
    excerptInput && excerptInput.length > 0
      ? excerptInput
      : (fullText ?? subject ?? title ?? "").trim().slice(0, 160);

  // Audiencia (047): 'todos' incluye a los Amigos de la Fe; cualquier
  // otro valor colapsa a 'creyentes', que es el lado seguro (la
  // invitación a la Fiesta no puede llegarle a quien no es bahá'í).
  const audience: MessageAudience =
    formData.get("audience") === "todos" ? "todos" : "creyentes";

  const payload: Record<string, unknown> = {
    date: formData.get("date") as string,
    title,
    subject,
    excerpt,
    full_text: fullText,
    source: "asamblea_local",
    audience,
    // 048: "Nuevo" dejó de escribirse a mano (es por lector). Lo que el
    // formulario declara es si pide confirmación de lectura.
    ask_confirmation: formData.get("ask_confirmation") === "on",
  };

  if (!payload.date || !payload.title) {
    setFlashToast({ tone: "error", message: "Faltan campos obligatorios." });
    redirect("/admin/comunicados");
  }

  const pdfFile = formData.get("pdf_file") as File | null;
  const imageFile = formData.get("image_file") as File | null;
  const removePdf = formData.get("pdf_remove") === "on";
  const removeImage = formData.get("image_remove") === "on";

  if (pdfFile && pdfFile.size > 0) {
    const url = await uploadAttachment(pdfFile, "pdf");
    if (url) payload.pdf_url = url;
  } else if (removePdf) {
    payload.pdf_url = null;
  }

  if (imageFile && imageFile.size > 0) {
    const url = await uploadAttachment(imageFile, "image");
    if (url) payload.image_url = url;
  } else if (removeImage) {
    payload.image_url = null;
  }

  // Los comunicados son SIEMPRE locales: fijamos la localidad explícita
  // (ya no hay trigger de auto-locality en messages).
  let messageId = id;
  let error: { message: string } | null = null;
  if (id) {
    ({ error } = await supabase.from("messages").update(payload).eq("id", id));
  } else {
    const res = await supabase
      .from("messages")
      .insert({ ...payload, locality_id: session.locality.id })
      .select("id")
      .single();
    error = res.error;
    messageId = (res.data as { id: string } | null)?.id ?? null;
  }

  // La pregunta para votar (051), después del comunicado: si falla, el
  // comunicado ya quedó guardado y se avisa sin deshacerlo.
  let pollWarning: string | null = null;
  let pollQuestion: string | null = null;
  if (!error && messageId) {
    const poll = await savePoll(formData, messageId);
    pollWarning = poll.warning;
    pollQuestion = poll.question;
  }

  // Push solo al PUBLICAR uno nuevo (no al editar), a la audiencia del
  // comunicado — incluido quien publica, sirve como confirmación. El
  // aviso lleva directo a la tarjeta (`#c-<id>`), que con una encuesta
  // es lo que importa: la pregunta tiene que quedar bajo el dedo.
  if (!id && !error && messageId) {
    const recipients = await getLocalityMemberIds(session.locality.id, {
      bahaiOnly: audience === "creyentes",
    });
    await sendPushToUsers(recipients, {
      title: pollQuestion ? "La Asamblea pregunta" : "Nuevo comunicado",
      body: pollQuestion ?? title,
      url: `/comunicados#c-${messageId}`,
      tag: "comunicado",
    });
  }

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : pollWarning
        ? { tone: "error", message: pollWarning }
        : { tone: "success", message: id ? "Comunicado actualizado." : "Comunicado publicado." }
  );

  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  revalidatePath("/");
  redirect("/admin/comunicados");
}

export async function deleteComunicadoAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseServer();
  const id = formData.get("id") as string;
  if (id) {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("source", "asamblea_local");
    setFlashToast(
      error
        ? { tone: "error", message: `No se pudo borrar: ${error.message}` }
        : { tone: "success", message: "Comunicado borrado." }
    );
  }
  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  revalidatePath("/");
}

// ─── Encuestas (migración 051) ─────────────────────────────────────

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
async function savePoll(
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

/**
 * Cierra (o reabre) la votación a mano, desde el informe. Cerrar es lo
 * que la Asamblea hace antes de leer el resultado en la reunión: a partir
 * de ahí nadie vota y la tarjeta muestra el total final a todo el mundo.
 */
export async function setPollClosedAction(formData: FormData) {
  await requireAdmin();
  const pollId = formData.get("poll_id") as string;
  const messageId = formData.get("message_id") as string;
  const close = formData.get("close") === "1";
  if (!pollId) return;
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("message_polls")
    .update({ closed_at: close ? new Date().toISOString() : null })
    .eq("id", pollId);
  setFlashToast(
    error
      ? { tone: "error", message: `No se pudo ${close ? "cerrar" : "reabrir"} la votación: ${error.message}` }
      : { tone: "success", message: close ? "Votación cerrada." : "Votación reabierta." }
  );
  revalidatePath(`/admin/comunicados/${messageId}/lectura`);
  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
}
