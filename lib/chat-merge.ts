import type { ChatMessage } from "./types";

/**
 * La burbuja optimista (id "local-…") y la fila real tienen que terminar
 * siendo UNA. La fila real llega por dos caminos, en cualquier orden: el
 * action devuelve su id, y Realtime manda el INSERT.
 *
 * Antes se emparejaban por remitente + texto + "menos de 10 s de
 * diferencia" entre `created_at` del navegador y el de la base. Con el
 * reloj de la PC corrido más de 10 s el par no se encontraba y el mensaje
 * se veía duplicado hasta recargar (2026-09-29). Ahora el vínculo firme es
 * el id que devuelve el action; Realtime empareja por remitente y texto
 * sin mirar la hora (una burbuja optimista es, por definición, un envío
 * pendiente, así que no hay otra con qué confundirla).
 */

export function mergeIncoming<T extends ChatMessage>(
  prev: T[],
  incoming: T
): T[] {
  if (prev.some((x) => x.id === incoming.id)) return prev;
  const i = prev.findIndex(
    (x) =>
      x.id.startsWith("local-") &&
      x.from_user_id === incoming.from_user_id &&
      x.text === incoming.text
  );
  if (i < 0) return [...prev, incoming];
  const next = prev.slice();
  next[i] = incoming;
  return next;
}

/** El action confirmó el guardado: la optimista pasa a tener el id real,
 *  o desaparece si Realtime ya trajo esa fila. */
export function confirmSent<T extends ChatMessage>(
  prev: T[],
  optimisticId: string,
  saved: { id: string; created_at: string }
): T[] {
  if (prev.some((x) => x.id === saved.id)) {
    return prev.filter((x) => x.id !== optimisticId);
  }
  return prev.map((x) =>
    x.id === optimisticId ? { ...x, id: saved.id, created_at: saved.created_at } : x
  );
}

/** Realtime avisó un UPDATE (llegó, o lo leyeron): se actualizan los
 *  checks de esa fila sin perder lo que es solo de la pantalla (`mine`). */
export function applyUpdate<T extends ChatMessage>(prev: T[], updated: ChatMessage): T[] {
  if (!prev.some((x) => x.id === updated.id)) return prev;
  return prev.map((x) =>
    x.id === updated.id
      ? {
          ...x,
          read: updated.read,
          read_by_member: updated.read_by_member,
          delivered_at: updated.delivered_at,
        }
      : x
  );
}
