/**
 * Helpers de encuestas (051) que no tocan la base. Viven aparte de
 * `lib/polls.ts` porque los usan componentes de cliente (`PollBlock`,
 * `PollFields`) y aquel importa el cliente de Supabase del servidor
 * (`next/headers`), que no puede entrar en un bundle de navegador.
 */

import type { MessagePoll } from "./types";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;

/** Abierta: no la cerró la Asamblea y no pasó la fecha de cierre. */
export function isPollOpen(
  poll: Pick<MessagePoll, "closes_at" | "closed_at">,
  now = new Date()
): boolean {
  if (poll.closed_at) return false;
  if (poll.closes_at && new Date(poll.closes_at).getTime() <= now.getTime()) return false;
  return true;
}

/** Porcentaje sobre las personas que votaron (en múltiple, las barras no suman 100). */
export function pollPercent(votes: number, participants: number): number {
  return participants === 0 ? 0 : Math.round((votes / participants) * 100);
}

/** Códigos con los que Postgres/PostgREST dicen "esa tabla o función no existe". */
export function isSchemaMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "42883" || code === "PGRST202" || code === "PGRST204";
}
