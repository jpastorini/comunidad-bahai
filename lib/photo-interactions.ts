import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type {
  PhotoComment,
  PhotoReaction,
  PhotoReactionSummary,
  ReactionEmoji,
} from "./types";

// Re-export para que server code siga importando desde acá.
export { REACTION_EMOJIS } from "./reaction-emojis";

const EMPTY_COUNTS: Record<ReactionEmoji, number> = {
  heart: 0,
  pray: 0,
  star: 0,
  flower: 0,
};

export async function getPhotoReactions(
  photoId: string,
  currentUserId: string | null
): Promise<PhotoReactionSummary> {
  if (!isSupabaseConfigured()) {
    return { counts: { ...EMPTY_COUNTS }, mine: [] };
  }
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("event_photo_reactions")
    .select("user_id, emoji")
    .eq("photo_id", photoId);

  const counts = { ...EMPTY_COUNTS };
  const mine: ReactionEmoji[] = [];
  for (const row of (data ?? []) as Pick<PhotoReaction, "user_id" | "emoji">[]) {
    counts[row.emoji] = (counts[row.emoji] ?? 0) + 1;
    if (currentUserId && row.user_id === currentUserId) mine.push(row.emoji);
  }
  return { counts, mine };
}

export async function getPhotoComments(photoId: string): Promise<PhotoComment[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("event_photo_comments")
    .select("*")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[getPhotoComments] error:", error);
    return [];
  }
  return (data ?? []) as PhotoComment[];
}

/**
 * Batched: trae reacciones + comentarios de muchas fotos en dos queries.
 * Usado al renderizar la galería para que el Lightbox no tenga que pegarle
 * a la red al abrirse.
 */
export async function getPhotosInteractions(
  photoIds: string[],
  currentUserId: string | null
): Promise<{
  reactions: Record<string, PhotoReactionSummary>;
  comments: Record<string, PhotoComment[]>;
}> {
  const reactions: Record<string, PhotoReactionSummary> = {};
  const comments: Record<string, PhotoComment[]> = {};
  for (const id of photoIds) {
    reactions[id] = { counts: { ...EMPTY_COUNTS }, mine: [] };
    comments[id] = [];
  }
  if (!isSupabaseConfigured() || photoIds.length === 0) {
    return { reactions, comments };
  }

  const supabase = createSupabaseServer();

  // Conteo de reacciones por emoji agregado en SQL (ver migración 023).
  // Las reacciones del usuario actual ('mine') se traen aparte: solo sus
  // filas, no todas. Los comentarios se precargan completos porque el
  // Lightbox los necesita al abrirse.
  const [countsRes, mineRes, commentsRes] = await Promise.all([
    supabase.rpc("get_photo_reaction_counts", { photo_ids: photoIds }),
    currentUserId
      ? supabase
          .from("event_photo_reactions")
          .select("photo_id, emoji")
          .eq("user_id", currentUserId)
          .in("photo_id", photoIds)
      : Promise.resolve({ data: [] as { photo_id: string; emoji: ReactionEmoji }[] }),
    supabase
      .from("event_photo_comments")
      .select("*")
      .in("photo_id", photoIds)
      .order("created_at", { ascending: true }),
  ]);

  for (const row of (countsRes.data ?? []) as Array<{
    photo_id: string;
    emoji: ReactionEmoji;
    count: number;
  }>) {
    const summary = reactions[row.photo_id];
    if (!summary) continue;
    summary.counts[row.emoji] = Number(row.count) || 0;
  }

  for (const row of (mineRes.data ?? []) as Array<{
    photo_id: string;
    emoji: ReactionEmoji;
  }>) {
    const summary = reactions[row.photo_id];
    if (summary) summary.mine.push(row.emoji);
  }

  for (const row of (commentsRes.data ?? []) as PhotoComment[]) {
    const arr = comments[row.photo_id];
    if (arr) arr.push(row);
  }

  return { reactions, comments };
}
