"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ReactionEmoji } from "@/lib/types";

type Result = { ok: boolean; error: string | null };

const VALID_EMOJIS: ReactionEmoji[] = ["heart", "pray", "star", "flower"];

function eventPaths(eventType: "calendar" | "feast", eventId: string) {
  if (eventType === "calendar") {
    return [`/calendario/${eventId}`, `/calendario/${eventId}/galeria`];
  }
  return [`/fiestas/${eventId}`, `/fiestas/${eventId}/galeria`];
}

/** Toggle: si ya existe la (foto, user, emoji) la borra; si no, la inserta. */
export async function toggleReactionAction(
  photoId: string,
  emoji: ReactionEmoji
): Promise<Result> {
  if (!VALID_EMOJIS.includes(emoji)) {
    return { ok: false, error: "Reacción inválida." };
  }
  const session = await requireMember();
  const supabase = createSupabaseServer();

  const { data: photo } = await supabase
    .from("event_photos")
    .select("id, event_type, event_id, locality_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Foto no encontrada." };
  if (photo.locality_id !== session.locality.id) {
    return { ok: false, error: "No podés reaccionar a fotos de otra localidad." };
  }

  const { data: existing } = await supabase
    .from("event_photo_reactions")
    .select("id")
    .eq("photo_id", photoId)
    .eq("user_id", session.user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("event_photo_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("event_photo_reactions").insert({
      photo_id: photoId,
      user_id: session.user.id,
      emoji,
      locality_id: session.locality.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  for (const p of eventPaths(photo.event_type, photo.event_id)) revalidatePath(p);
  return { ok: true, error: null };
}

export async function addCommentAction(
  photoId: string,
  body: string
): Promise<Result> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "El comentario no puede estar vacío." };
  if (trimmed.length > 500) {
    return { ok: false, error: "El comentario no puede exceder los 500 caracteres." };
  }

  const session = await requireMember();
  const supabase = createSupabaseServer();

  const { data: photo } = await supabase
    .from("event_photos")
    .select("id, event_type, event_id, locality_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Foto no encontrada." };
  if (photo.locality_id !== session.locality.id) {
    return { ok: false, error: "No podés comentar fotos de otra localidad." };
  }

  const authorName =
    session.profile.full_name || session.user.email || "Miembro";

  const { error } = await supabase.from("event_photo_comments").insert({
    photo_id: photoId,
    user_id: session.user.id,
    author_name: authorName,
    body: trimmed,
    locality_id: session.locality.id,
  });
  if (error) return { ok: false, error: error.message };

  for (const p of eventPaths(photo.event_type, photo.event_id)) revalidatePath(p);
  return { ok: true, error: null };
}

export async function deleteCommentAction(commentId: string): Promise<Result> {
  const session = await requireMember();
  const supabase = createSupabaseServer();

  const { data: comment } = await supabase
    .from("event_photo_comments")
    .select("id, user_id, photo_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { ok: false, error: "Comentario no encontrado." };

  const isOwner = comment.user_id === session.user.id;
  const isAdmin = session.profile.role === "admin";
  if (!isOwner && !isAdmin) {
    return { ok: false, error: "No tenés permiso para borrar este comentario." };
  }

  const { error } = await supabase
    .from("event_photo_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  const { data: photo } = await supabase
    .from("event_photos")
    .select("event_type, event_id")
    .eq("id", comment.photo_id)
    .maybeSingle();
  if (photo) {
    for (const p of eventPaths(photo.event_type, photo.event_id)) revalidatePath(p);
  }
  return { ok: true, error: null };
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  const session = await requireMember();
  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("social_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", session.user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/notificaciones");
  return { ok: true, error: null };
}
