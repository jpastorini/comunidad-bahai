/**
 * Constante compartida entre server y client.
 * Definida aparte para que client components puedan importarla sin
 * arrastrar dependencias server-only (next/headers) via photo-interactions.
 */
import type { ReactionEmoji } from "./types";

export const REACTION_EMOJIS: { key: ReactionEmoji; char: string }[] = [
  { key: "heart", char: "❤️" },
  { key: "pray", char: "🙏" },
  { key: "star", char: "⭐" },
  { key: "flower", char: "🌸" },
];
