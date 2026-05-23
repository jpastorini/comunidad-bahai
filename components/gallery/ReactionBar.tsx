"use client";

import { useEffect, useState, useTransition } from "react";
import { REACTION_EMOJIS } from "@/lib/reaction-emojis";
import type { PhotoReactionSummary, ReactionEmoji } from "@/lib/types";
import { toggleReactionAction } from "./interaction-actions";

type Props = {
  photoId: string;
  initial: PhotoReactionSummary;
  /** Si null, se muestra como solo-lectura (no logueado). */
  currentUserId: string | null;
  /** Dark theme para usar dentro del lightbox. */
  dark?: boolean;
};

/**
 * Barra de reacciones con toggle optimista. Una reacción por emoji por usuario.
 */
export function ReactionBar({
  photoId,
  initial,
  currentUserId,
  dark = false,
}: Props) {
  const [counts, setCounts] = useState(initial.counts);
  const [mine, setMine] = useState<Set<ReactionEmoji>>(new Set(initial.mine));
  const [pending, startTransition] = useTransition();

  // Sync si el server re-renderiza con datos nuevos.
  useEffect(() => {
    setCounts(initial.counts);
    setMine(new Set(initial.mine));
  }, [initial.counts, initial.mine, photoId]);

  function onToggle(emoji: ReactionEmoji) {
    if (!currentUserId || pending) return;

    const wasMine = mine.has(emoji);
    const nextMine = new Set(mine);
    if (wasMine) nextMine.delete(emoji);
    else nextMine.add(emoji);
    setMine(nextMine);
    setCounts((c) => ({
      ...c,
      [emoji]: Math.max(0, (c[emoji] ?? 0) + (wasMine ? -1 : 1)),
    }));

    startTransition(async () => {
      const res = await toggleReactionAction(photoId, emoji);
      if (!res.ok) {
        // Rollback
        setMine(new Set(mine));
        setCounts(counts);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {REACTION_EMOJIS.map(({ key, char }) => {
        const isMine = mine.has(key);
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            disabled={!currentUserId}
            aria-pressed={isMine}
            aria-label={`Reaccionar ${char}`}
            className={
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors " +
              (isMine
                ? dark
                  ? "bg-rose-500/25 text-rose-300"
                  : "bg-rose-500/10 text-rose-600"
                : dark
                  ? "text-white/70 hover:bg-white/10"
                  : "text-muted hover:bg-black/[0.04]") +
              (currentUserId ? "" : " cursor-default opacity-60")
            }
          >
            <span className="text-[15px] leading-none">{char}</span>
            {count > 0 && <span className="leading-none">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
