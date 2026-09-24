"use client";

import { useState, useTransition } from "react";
import { IconArrowRight } from "@/components/Icons";
import { setVolunteerAction } from "./actions";

type Props = {
  needId: string;
  initialMine: boolean;
  /** null si no se pudo contar (falta la 064): no se muestra la cifra. */
  initialCount: number | null;
};

/**
 * Ofrecerse / retirarse de una necesidad. Ofrecerse va de un toque (no
 * compromete a nada irreversible y la Asamblea igual va a llamar para
 * coordinar); retirarse pide confirmación en el mismo lugar, porque
 * alguien ya puede estar contando con esa persona.
 */
export function VolunteerButton({ needId, initialMine, initialCount }: Props) {
  const [mine, setMine] = useState(initialMine);
  const [count, setCount] = useState(initialCount);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(offer: boolean) {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const res = await setVolunteerAction(needId, offer);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMine(offer);
      setCount((c) => (c === null ? c : Math.max(0, c + (offer ? 1 : -1))));
    });
  }

  const others = count === null ? null : count - (mine ? 1 : 0);

  return (
    <div>
      {mine ? (
        <div className="rounded-xl bg-green/[0.08] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-green">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Te ofreciste
          </div>
          <p className="mt-0.5 font-body text-[11.5px] leading-[1.45] text-dark/70">
            La Asamblea ya recibió el aviso y se va a comunicar con vos para
            coordinar.
          </p>
          {confirming ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-dark/70">¿Quitarte?</span>
              <button
                type="button"
                onClick={() => apply(false)}
                disabled={pending}
                className="tap rounded-lg bg-rose-600 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60"
              >
                Sí, quitarme
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="tap rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-muted"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="tap mt-1.5 text-[11.5px] font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-60"
            >
              Ya no puedo
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={pending}
          className="tap inline-flex items-center gap-1.5 rounded-xl border border-terra/20 bg-terra/[0.05] px-3.5 py-2 text-[12.5px] font-semibold text-terra disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Ofrecerme"}
          {!pending && <IconArrowRight size={11} />}
        </button>
      )}

      {others !== null && (
        <p className="mt-2 font-body text-[11px] text-muted">
          {others === 0
            ? mine
              ? "Sos la primera persona en ofrecerse."
              : "Todavía nadie se ofreció."
            : others === 1
              ? mine
                ? "Otra persona también se ofreció."
                : "Ya se ofreció una persona."
              : mine
                ? `Otras ${others} personas también se ofrecieron.`
                : `Ya se ofrecieron ${others} personas.`}
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11.5px] font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}
