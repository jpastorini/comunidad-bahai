/**
 * Encuestas de comunicados (migración 051).
 *
 * Dos lados de las mismas tablas:
 *   · el creyente lee la pregunta y las opciones (RLS de `messages`),
 *     SU participación y los totales por `poll_results()`;
 *   · la Asamblea lee además quién votó y, si la encuesta no es
 *     anónima, quién votó qué.
 *
 * Todo pasa por el cliente con cookies: la RLS decide quién ve qué. Lo
 * único que escribe un voto es la RPC `cast_vote()`.
 */

import { audienceFor, getAudience, type AudienceProfile } from "./message-reads";
import { createSupabaseServer, isSupabaseConfigured } from "./supabase/server";
import type { Message, MessagePoll, MyPollVote, PollOption, PollResults } from "./types";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;

/** Abierta: no la cerró la Asamblea y no pasó la fecha de cierre. */
export function isPollOpen(poll: Pick<MessagePoll, "closes_at" | "closed_at">, now = new Date()): boolean {
  if (poll.closed_at) return false;
  if (poll.closes_at && new Date(poll.closes_at).getTime() <= now.getTime()) return false;
  return true;
}

/** Códigos con los que Postgres/PostgREST dicen "esa tabla o función no existe". */
export function isSchemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "42883" || code === "PGRST202" || code === "PGRST204";
}

type PollRow = Omit<MessagePoll, "options"> & { poll_options: PollOption[] | null };

function normalize(row: PollRow): MessagePoll {
  const { poll_options, ...rest } = row;
  const options = [...(poll_options ?? [])].sort((a, b) => a.position - b.position);
  return { ...rest, options };
}

/** Encuestas de un conjunto de comunicados, indexadas por comunicado. */
export async function getPollsForMessages(messageIds: string[]): Promise<Map<string, MessagePoll>> {
  const map = new Map<string, MessagePoll>();
  if (!isSupabaseConfigured() || messageIds.length === 0) return map;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("message_polls")
    .select("id, message_id, question, allow_multiple, anonymous, closes_at, closed_at, poll_options(id, poll_id, position, label)")
    .in("message_id", messageIds);
  if (error) {
    // Antes de la 051 la tabla no existe: los comunicados salen sin encuesta.
    console.error("[polls] getPollsForMessages:", error.message);
    return map;
  }
  for (const r of (data ?? []) as PollRow[]) map.set(r.message_id, normalize(r));
  return map;
}

export async function getPollForMessage(messageId: string): Promise<MessagePoll | null> {
  const map = await getPollsForMessages([messageId]);
  return map.get(messageId) ?? null;
}

/** Participación del usuario actual, por encuesta. La RLS ya acota a sus filas. */
export async function getMyPollVotes(userId: string, pollIds: string[]): Promise<Map<string, MyPollVote>> {
  const map = new Map<string, MyPollVote>();
  if (!isSupabaseConfigured() || pollIds.length === 0) return map;
  const supabase = createSupabaseServer();
  const [partRes, votesRes] = await Promise.all([
    supabase
      .from("poll_participants")
      .select("poll_id, voted_at")
      .eq("profile_id", userId)
      .in("poll_id", pollIds),
    supabase
      .from("poll_votes")
      .select("poll_id, option_id")
      .eq("profile_id", userId)
      .in("poll_id", pollIds),
  ]);
  if (partRes.error) {
    console.error("[polls] my participations:", partRes.error.message);
    return map;
  }
  for (const p of (partRes.data ?? []) as Array<{ poll_id: string; voted_at: string }>) {
    map.set(p.poll_id, { voted_at: p.voted_at, option_ids: [] });
  }
  if (votesRes.error) {
    console.error("[polls] my votes:", votesRes.error.message);
    return map;
  }
  for (const v of (votesRes.data ?? []) as Array<{ poll_id: string; option_id: string }>) {
    map.get(v.poll_id)?.option_ids.push(v.option_id);
  }
  return map;
}

/** Totales por encuesta vía `poll_results()`: solo números. */
export async function getPollResults(pollIds: string[]): Promise<Map<string, PollResults>> {
  const map = new Map<string, PollResults>();
  if (!isSupabaseConfigured() || pollIds.length === 0) return map;
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("poll_results", { p_poll_ids: pollIds });
  if (error) {
    console.error("[polls] results:", error.message);
    return map;
  }
  for (const r of (data ?? []) as Array<{
    poll_id: string;
    option_id: string;
    votes: number;
    participants: number;
  }>) {
    const cur = map.get(r.poll_id) ?? { participants: r.participants, votes: {} };
    cur.participants = r.participants;
    cur.votes[r.option_id] = r.votes;
    map.set(r.poll_id, cur);
  }
  for (const id of pollIds) if (!map.has(id)) map.set(id, { participants: 0, votes: {} });
  return map;
}

/** Porcentaje sobre las personas que votaron (en múltiple, las barras no suman 100). */
export function pollPercent(votes: number, participants: number): number {
  return participants === 0 ? 0 : Math.round((votes / participants) * 100);
}

// ─── Informe para la Asamblea ─────────────────────────────────────

export type PollReportPerson = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  voted_at: string | null;
  last_seen_at: string | null;
  /** Opciones que eligió; vacío si la encuesta es anónima. */
  option_ids: string[];
};

export type PollReport = {
  poll: MessagePoll;
  results: PollResults;
  /** Audiencia del comunicado (el denominador). */
  total: number;
  /** Votaron. En anónima, sin opciones. */
  voted: PollReportPerson[];
  /** No votaron todavía. En anónima va vacío: con pocas personas, saber quién falta ya dice mucho. */
  pending: PollReportPerson[];
};

/**
 * El informe de la Asamblea. Los totales salen de la misma función que
 * ve la comunidad; los nombres, de `poll_participants` y `poll_votes`
 * con la RLS de admin. En una encuesta anónima las filas de votos no
 * traen a nadie y las listas con nombre quedan vacías a propósito.
 */
export async function getPollReport(
  m: Message,
  poll: MessagePoll,
  localityId: string
): Promise<PollReport | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServer();
  const [all, results, partRes, votesRes] = await Promise.all([
    getAudience(supabase, localityId),
    getPollResults([poll.id]),
    supabase.from("poll_participants").select("profile_id, voted_at").eq("poll_id", poll.id),
    poll.anonymous
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("poll_votes").select("profile_id, option_id").eq("poll_id", poll.id),
  ]);
  if (partRes.error || votesRes.error) {
    console.error("[polls] report:", (partRes.error ?? votesRes.error)?.message);
    return null;
  }
  const participants = new Map<string, string>();
  for (const p of (partRes.data ?? []) as Array<{ profile_id: string; voted_at: string }>) {
    participants.set(p.profile_id, p.voted_at);
  }
  const choices = new Map<string, string[]>();
  for (const v of (votesRes.data ?? []) as Array<{ profile_id: string | null; option_id: string }>) {
    if (!v.profile_id) continue;
    const arr = choices.get(v.profile_id) ?? [];
    arr.push(v.option_id);
    choices.set(v.profile_id, arr);
  }

  const audience = audienceFor(m, all);
  const voted: PollReportPerson[] = [];
  const pending: PollReportPerson[] = [];
  const toPerson = (p: AudienceProfile): PollReportPerson => ({
    id: p.id,
    full_name: p.full_name?.trim() || "Sin nombre",
    avatar_url: p.avatar_url,
    voted_at: participants.get(p.id) ?? null,
    last_seen_at: p.last_seen_at,
    option_ids: choices.get(p.id) ?? [],
  });
  for (const p of audience) {
    if (participants.has(p.id)) voted.push(toPerson(p));
    else pending.push(toPerson(p));
  }
  voted.sort((a, b) => (b.voted_at ?? "").localeCompare(a.voted_at ?? ""));
  pending.sort((a, b) => (a.last_seen_at ?? "").localeCompare(b.last_seen_at ?? ""));

  return {
    poll,
    results: results.get(poll.id) ?? { participants: 0, votes: {} },
    total: audience.length,
    voted: poll.anonymous ? [] : voted,
    pending: poll.anonymous ? [] : pending,
  };
}

/** Cuántos votaron por comunicado, para la tabla del panel. `null` si la tabla no existe. */
export async function getPollCountsForMessages(
  messageIds: string[]
): Promise<Map<string, { poll_id: string; participants: number; open: boolean }> | null> {
  const out = new Map<string, { poll_id: string; participants: number; open: boolean }>();
  if (!isSupabaseConfigured() || messageIds.length === 0) return out;
  const polls = await getPollsForMessages(messageIds);
  if (polls.size === 0) return out;
  const supabase = createSupabaseServer();
  const ids = [...polls.values()].map((p) => p.id);
  const { data, error } = await supabase
    .from("poll_participants")
    .select("poll_id")
    .in("poll_id", ids);
  if (error) {
    console.error("[polls] counts:", error.message);
    return null;
  }
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ poll_id: string }>) {
    counts.set(r.poll_id, (counts.get(r.poll_id) ?? 0) + 1);
  }
  for (const [messageId, poll] of polls) {
    out.set(messageId, {
      poll_id: poll.id,
      participants: counts.get(poll.id) ?? 0,
      open: isPollOpen(poll),
    });
  }
  return out;
}

