"use client";

import { useState, useTransition } from "react";
import { setFeastRsvpAction } from "./actions";

type Location = { id: string; name: string };

type Props = {
  feastId: string;
  /** Lugares de la Fiesta; con más de uno, se elige adónde. */
  locations: Location[];
  initialGoing: boolean;
  initialLocationId: string | null;
};

/**
 * "Voy" a la Fiesta (065). Solo afirmativo, a pedido del usuario: no hay
 * "No puedo". Lo que la persona ve es su propia respuesta; ni el total ni
 * quién más va, que es de la Asamblea.
 */
export function RsvpBlock({ feastId, locations, initialGoing, initialLocationId }: Props) {
  const [going, setGoing] = useState(initialGoing);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const multi = locations.length > 1;
  const single = locations.length === 1 ? locations[0] : null;
  const chosen = locations.find((l) => l.id === locationId) ?? null;

  function save(nextGoing: boolean, nextLocation: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await setFeastRsvpAction(feastId, nextGoing, nextLocation);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGoing(nextGoing);
      setLocationId(nextGoing ? nextLocation : null);
      setChoosing(false);
    });
  }

  const locationButtons = (
    <div className="flex flex-col gap-2">
      {locations.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => save(true, l.id)}
          disabled={pending}
          className={`tap rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-semibold disabled:opacity-60 ${
            going && l.id === locationId
              ? "border-green/40 bg-green/[0.08] text-green"
              : "border-terra/20 bg-terra/[0.05] text-terra"
          }`}
        >
          Voy a {l.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mb-5 rounded-2xl bg-card p-4 shadow-card-soft">
      {going && !choosing ? (
        <>
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-green">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {chosen ? `Anotaste que vas a ${chosen.name}` : "Anotaste que vas"}
          </div>
          <p className="mt-1 font-body text-[12px] leading-[1.5] text-muted">
            La Asamblea ya lo sabe. Te esperamos.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {multi && (
              <button
                type="button"
                onClick={() => setChoosing(true)}
                disabled={pending}
                className="tap text-[12px] font-semibold text-terra disabled:opacity-60"
              >
                Cambiar de lugar
              </button>
            )}
            <button
              type="button"
              onClick={() => save(false, null)}
              disabled={pending}
              className="tap text-[12px] font-semibold text-muted disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Me equivoqué, no voy"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-[13.5px] font-semibold text-dark">
            {multi ? "¿Adónde vas?" : "¿Venís a la Fiesta?"}
          </div>
          <p className="mt-0.5 mb-3 font-body text-[12px] leading-[1.5] text-muted">
            Avisale a la Asamblea para que pueda preparar el encuentro.
          </p>
          {multi ? (
            locationButtons
          ) : (
            <button
              type="button"
              onClick={() => save(true, single?.id ?? null)}
              disabled={pending}
              className="tap inline-flex items-center justify-center rounded-xl bg-terra px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-card-soft disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Voy"}
            </button>
          )}
          {choosing && (
            <button
              type="button"
              onClick={() => setChoosing(false)}
              disabled={pending}
              className="tap mt-2.5 text-[12px] font-semibold text-muted"
            >
              Cancelar
            </button>
          )}
        </>
      )}
      {error && (
        <p className="mt-2.5 text-[12px] font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}
