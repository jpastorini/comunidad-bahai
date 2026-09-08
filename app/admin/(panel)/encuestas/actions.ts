"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { civilDateISO } from "@/lib/citas";
import { savePoll } from "@/lib/polls-admin";
import { getLocalityMemberIds, sendPushToUsers } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { setFlashToast } from "@/lib/toast";
import type { MessageAudience } from "@/lib/types";

/**
 * Alta y edición de una encuesta desde su propia pantalla (051).
 *
 * Por debajo es un comunicado con pregunta —la misma fila de `messages`
 * y la misma `savePoll()` que el formulario de Comunicados—, pero acá el
 * formulario está pensado desde la pregunta: el título del comunicado ES
 * la pregunta, la fecha es hoy y el texto de acompañamiento es opcional.
 * En la tarjeta de la app la pregunta no se repite (ver `hideQuestion`).
 */
export async function upsertEncuestaAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = createSupabaseServer();

  const id = (formData.get("id") as string | null) || null;
  const question = ((formData.get("poll_question") as string) || "").trim().slice(0, 200);
  const intro = ((formData.get("intro") as string) || "").trim() || null;
  const audience: MessageAudience =
    formData.get("audience") === "todos" ? "todos" : "creyentes";

  const payload: Record<string, unknown> = {
    full_text: intro,
    excerpt: (intro ?? "La Asamblea pregunta.").slice(0, 160),
    audience,
  };
  // Con votos emitidos la pregunta viene congelada y no viaja: el título
  // se conserva. Sin votos (o al crear), el título es la pregunta.
  if (question) payload.title = question;

  let messageId = id;
  let error: { message: string } | null = null;
  if (id) {
    ({ error } = await supabase.from("messages").update(payload).eq("id", id));
  } else {
    if (!question) {
      setFlashToast({ tone: "error", message: "La encuesta necesita una pregunta." });
      redirect("/admin/encuestas/nueva");
    }
    const res = await supabase
      .from("messages")
      .insert({
        ...payload,
        title: question,
        date: civilDateISO(),
        source: "asamblea_local",
        ask_confirmation: false,
        locality_id: session.locality.id,
      })
      .select("id")
      .single();
    error = res.error;
    messageId = (res.data as { id: string } | null)?.id ?? null;
  }

  let pollWarning: string | null = null;
  if (!error && messageId) {
    const poll = await savePoll(formData, messageId);
    pollWarning = poll.warning;
    if (!id && !poll.question) {
      // Sin encuesta no tiene sentido dejar un comunicado vacío colgado.
      await supabase.from("messages").delete().eq("id", messageId);
      setFlashToast({
        tone: "error",
        message: pollWarning ?? "No se pudo crear la encuesta.",
      });
      redirect("/admin/encuestas/nueva");
    }
  }

  if (!id && !error && messageId) {
    const recipients = await getLocalityMemberIds(session.locality.id, {
      bahaiOnly: audience === "creyentes",
    });
    await sendPushToUsers(recipients, {
      title: "La Asamblea pregunta",
      body: question,
      url: `/comunicados#c-${messageId}`,
      tag: "comunicado",
    });
  }

  setFlashToast(
    error
      ? { tone: "error", message: `Error: ${error.message}` }
      : pollWarning
        ? { tone: "error", message: pollWarning }
        : { tone: "success", message: id ? "Encuesta actualizada." : "Encuesta publicada." }
  );

  revalidatePath("/admin/encuestas");
  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  revalidatePath("/");
  redirect(id ? `/admin/encuestas/${id}` : "/admin/encuestas");
}

/** Borra la encuesta y el comunicado que la lleva (cascade). */
export async function deleteEncuestaAction(formData: FormData) {
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
        : { tone: "success", message: "Encuesta borrada." }
    );
  }
  revalidatePath("/admin/encuestas");
  revalidatePath("/admin/comunicados");
  revalidatePath("/comunicados");
  revalidatePath("/");
}
