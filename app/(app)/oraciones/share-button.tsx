"use client";

import { useState } from "react";
import { IconSend } from "@/components/Icons";

type Props = {
  title: string;
  body: string;
  reference: string;
};

/**
 * Comparte el texto de una oración por la Web Share API nativa (mejor UX
 * en mobile). Fallback: abre WhatsApp con el texto.
 */
export function SharePrayerButton({ title, body, reference }: Props) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    const text = `${title}\n\n${body}\n\n— ${reference}`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({ title, text });
          return;
        } catch {
          // sigue al fallback
        }
      }
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener");
    } finally {
      setSharing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className="tap inline-flex items-center gap-2 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12px] font-semibold text-terra hover:bg-terra/10 disabled:opacity-60"
    >
      <IconSend size={14} />
      Compartir oración
    </button>
  );
}
