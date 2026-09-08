"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { savePoll } from "@/lib/polls-admin";
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
  revalidatePath("/admin/encuestas");
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
  revalidatePath("/admin/encuestas");
  revalidatePath("/comunicados");
  revalidatePath("/");
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
  revalidatePath(`/admin/encuestas/${messageId}`);
  revalidatePath("/admin/comunicados");
  revalidatePath("/admin/encuestas");
  revalidatePath("/comunicados");
}
