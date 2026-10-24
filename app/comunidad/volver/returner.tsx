"use client";

import { useEffect, useRef, useTransition } from "react";
import { returnToCommunityAction } from "./actions";

/**
 * Cambia el sombrero recién al montarse, en el navegador. Si lo hiciera
 * el servidor al renderizar, un prefetch de cualquier link a la app desde
 * el panel le sacaría la estructura a quien está trabajando en ella.
 */
export function Returner({ next }: { next: string }) {
  const [pending, start] = useTransition();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    start(() => returnToCommunityAction(next));
  }, [next]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => returnToCommunityAction(next))}
      className="tap mt-5 rounded-xl bg-white/15 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/30 disabled:opacity-60"
    >
      {pending ? "Volviendo…" : "Volver a mi comunidad"}
    </button>
  );
}
